-- =============================================================================
-- One Day Stronger — Initial Schema
-- =============================================================================
-- Tables are created in FK-dependency order so foreign keys can be applied
-- immediately. All timestamps are timestamptz (UTC). All PKs are UUIDs.
-- =============================================================================

-- Enable uuid generation
create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. profiles — extends auth.users; created via trigger on signup
-- =============================================================================
create table public.profiles (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  age               integer check (age >= 10 and age <= 120),
  gender            text,
  rehab_goal        text check (rehab_goal in ('return_to_running','pain_free_daily','return_to_sport','other')),
  onboarding_step   text not null default 'intake'
                      check (onboarding_step in ('intake','goal','generating','complete')),
  notification_time time,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- =============================================================================
-- 2. exercises — PHT exercise library; admin-managed
-- =============================================================================
create table public.exercises (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  instructions text,
  category     text not null check (category in ('isometric','eccentric','strength','mobility','cardio')),
  video_url    text,
  created_at   timestamptz not null default now()
);

-- =============================================================================
-- 3. injury_intake — immutable after onboarding
-- =============================================================================
create table public.injury_intake (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(user_id) on delete cascade,
  injury_onset_date   date,
  mechanism           text check (mechanism in ('gradual','acute','post_surgery','unknown')),
  prior_treatment     text,
  irritability_level  text check (irritability_level in ('low','moderate','high')),
  training_background text,
  created_at          timestamptz not null default now()
);

-- =============================================================================
-- 4. injury_status — mutable; updates can trigger plan revision
-- =============================================================================
create table public.injury_status (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(user_id) on delete cascade,
  pain_level_baseline  integer check (pain_level_baseline >= 0 and pain_level_baseline <= 10),
  current_symptoms     text,
  last_flare_date      date,
  updated_at           timestamptz not null default now()
);

create trigger injury_status_updated_at
  before update on public.injury_status
  for each row execute procedure public.set_updated_at();

-- =============================================================================
-- 5. recovery_plans — LLM-generated plans; one active per user at a time
-- =============================================================================
create table public.recovery_plans (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles(user_id) on delete cascade,
  status                 text not null default 'active'
                           check (status in ('active','completed','paused','superseded')),
  rehab_goal             text,
  plain_language_summary text,
  prompt_version         text not null,
  generated_at           timestamptz not null default now()
);

-- =============================================================================
-- 6. plan_phases — phases within a recovery plan
-- =============================================================================
create table public.plan_phases (
  id                       uuid primary key default gen_random_uuid(),
  plan_id                  uuid not null references public.recovery_plans(id) on delete cascade,
  phase_number             integer not null check (phase_number >= 1),
  name                     text not null,
  description              text,
  plain_language_summary   text,
  estimated_duration_weeks integer check (estimated_duration_weeks >= 1),
  status                   text not null default 'upcoming'
                             check (status in ('upcoming','active','completed','regressed_from')),
  -- JSONB criteria shapes:
  -- progression_criteria: { pain_threshold, load_tolerance_pct, consistency_pct, window_days }
  -- regression_criteria:  { pain_consecutive_sessions, missed_sessions_window }
  progression_criteria     jsonb not null default '{}',
  regression_criteria      jsonb not null default '{}',
  started_at               timestamptz,
  completed_at             timestamptz,
  unique (plan_id, phase_number)
);

-- =============================================================================
-- 7. phase_exercises — prescribed exercises per phase
-- =============================================================================
create table public.phase_exercises (
  id               uuid primary key default gen_random_uuid(),
  phase_id         uuid not null references public.plan_phases(id) on delete cascade,
  exercise_id      uuid references public.exercises(id) on delete set null,
  prescribed_sets  integer check (prescribed_sets >= 1),
  prescribed_reps  text,       -- e.g. "8–12" or "30s hold"
  load_target      text,       -- e.g. "bodyweight", "light resistance", "15 kg"
  tempo            text,       -- e.g. "3-1-3"
  rest_seconds     integer check (rest_seconds >= 0),
  order_index      integer not null default 0,
  notes            text
);

-- =============================================================================
-- 8. sessions — one record per training day
-- =============================================================================
create table public.sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(user_id) on delete cascade,
  plan_phase_id  uuid references public.plan_phases(id) on delete set null,
  scheduled_date date not null,
  session_type   text not null check (session_type in ('training','rest','modified')),
  status         text not null default 'scheduled'
                   check (status in ('scheduled','completed','skipped','rest_day')),
  skip_reason    text check (skip_reason in ('life','pain','travel','other')),
  created_at     timestamptz not null default now(),
  unique (user_id, scheduled_date)
);

-- =============================================================================
-- 9. check_ins — daily pain + soreness logs
-- =============================================================================
create table public.check_ins (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(user_id) on delete cascade,
  session_id     uuid references public.sessions(id) on delete set null,
  pain_level     integer not null check (pain_level >= 0 and pain_level <= 10),
  soreness_level integer not null check (soreness_level >= 0 and soreness_level <= 10),
  triggered_by   text not null
                   check (triggered_by in ('notification','inline','manual','re_checkin_after_gap')),
  checked_in_at  timestamptz not null default now()
);

-- =============================================================================
-- 10. generated_workouts — LLM output per session
-- =============================================================================
create table public.generated_workouts (
  id                         uuid primary key default gen_random_uuid(),
  session_id                 uuid not null references public.sessions(id) on delete cascade,
  check_in_id                uuid references public.check_ins(id) on delete set null,
  workout_type               text not null
                               check (workout_type in ('standard','modified','rest_recommendation')),
  plain_language_explanation text,
  prompt_version             text not null,
  generated_at               timestamptz not null default now()
);

-- =============================================================================
-- 11. generated_workout_exercises — exercises within a generated workout
-- =============================================================================
create table public.generated_workout_exercises (
  id                   uuid primary key default gen_random_uuid(),
  generated_workout_id uuid not null references public.generated_workouts(id) on delete cascade,
  exercise_id          uuid references public.exercises(id) on delete set null,
  exercise_name        text not null,
  sets                 integer check (sets >= 1),
  reps                 text,
  load                 text,
  tempo                text,
  rest_seconds         integer check (rest_seconds >= 0),
  order_index          integer not null default 0,
  notes                text
);

-- =============================================================================
-- 12. workout_logs — user's post-session record
-- =============================================================================
create table public.workout_logs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(user_id) on delete cascade,
  session_id           uuid not null references public.sessions(id) on delete cascade,
  generated_workout_id uuid references public.generated_workouts(id) on delete set null,
  difficulty_rating    integer check (difficulty_rating >= 1 and difficulty_rating <= 10),
  session_notes        text,
  pain_during_session  integer check (pain_during_session >= 0 and pain_during_session <= 10),
  completed_at         timestamptz not null default now(),
  unique (session_id)   -- one log per session
);

-- =============================================================================
-- 13. exercise_logs — per-exercise actuals within a workout log
-- =============================================================================
create table public.exercise_logs (
  id               uuid primary key default gen_random_uuid(),
  workout_log_id   uuid not null references public.workout_logs(id) on delete cascade,
  exercise_id      uuid references public.exercises(id) on delete set null,
  exercise_name    text not null,
  sets_completed   integer check (sets_completed >= 0),
  reps_per_set     jsonb,   -- array of integers, e.g. [10, 9, 8]
  weight_per_set   jsonb,   -- array of floats in kg; null element = bodyweight
  modifications    text
);

-- =============================================================================
-- 14. plan_evolution_events — audit trail of all phase changes
-- =============================================================================
create table public.plan_evolution_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(user_id) on delete cascade,
  plan_id       uuid not null references public.recovery_plans(id) on delete cascade,
  from_phase_id uuid references public.plan_phases(id) on delete set null,
  to_phase_id   uuid references public.plan_phases(id) on delete set null,
  workout_log_id uuid references public.workout_logs(id) on delete set null,
  event_type    text not null
                  check (event_type in ('progression','regression','hold','plan_revised')),
  rationale     text,
  triggered_by  text not null check (triggered_by in ('auto','user_initiated')),
  seen          boolean not null default false,
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- 15. safety_events — safety guardrail triggers
-- =============================================================================
create table public.safety_events (
  id                              uuid primary key default gen_random_uuid(),
  user_id                         uuid not null references public.profiles(user_id) on delete cascade,
  session_id                      uuid references public.sessions(id) on delete set null,
  trigger                         text not null
                                    check (trigger in (
                                      'high_pain_checkin',
                                      'high_pain_logging',
                                      'atypical_symptoms',
                                      'intake_flagged'
                                    )),
  pain_level_reported             integer check (pain_level_reported >= 0 and pain_level_reported <= 10),
  details                         text,
  professional_care_acknowledged  boolean not null default false,
  acknowledged_at                 timestamptz,
  created_at                      timestamptz not null default now()
);

-- =============================================================================
-- 16. llm_call_logs — operational monitoring for all Claude API calls
-- No raw prompt content or LLM output stored here — operational data only.
-- =============================================================================
create table public.llm_call_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles(user_id) on delete set null,
  edge_function  text not null
                   check (edge_function in (
                     'generate-plan',
                     'generate-workout',
                     'evolve-plan',
                     'revise-plan'
                   )),
  model          text not null,
  prompt_version text not null,
  input_tokens   integer,
  output_tokens  integer,
  latency_ms     integer,
  success        boolean not null,
  error_message  text,
  called_at      timestamptz not null default now()
);

-- =============================================================================
-- Indexes for common query patterns
-- =============================================================================
create index idx_profiles_onboarding on public.profiles(onboarding_step) where onboarding_step != 'complete';
create index idx_sessions_user_date on public.sessions(user_id, scheduled_date desc);
create index idx_check_ins_user_date on public.check_ins(user_id, checked_in_at desc);
create index idx_workout_logs_user on public.workout_logs(user_id, completed_at desc);
create index idx_plan_evolution_user_unseen on public.plan_evolution_events(user_id, created_at desc) where seen = false;
create index idx_safety_events_user_unacked on public.safety_events(user_id, created_at desc) where professional_care_acknowledged = false;
create index idx_recovery_plans_user_active on public.recovery_plans(user_id) where status = 'active';
create index idx_plan_phases_plan_active on public.plan_phases(plan_id) where status = 'active';
create index idx_llm_call_logs_function on public.llm_call_logs(edge_function, called_at desc);
