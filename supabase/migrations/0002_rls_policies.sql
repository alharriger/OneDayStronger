-- =============================================================================
-- One Day Stronger — Row-Level Security Policies
-- =============================================================================
-- All user tables enforce ownership at the database layer.
-- A misconfigured query cannot return another user's data.
-- =============================================================================

-- Enable RLS on all user tables
alter table public.profiles             enable row level security;
alter table public.injury_intake        enable row level security;
alter table public.injury_status        enable row level security;
alter table public.recovery_plans       enable row level security;
alter table public.plan_phases          enable row level security;
alter table public.phase_exercises      enable row level security;
alter table public.exercises            enable row level security;
alter table public.sessions             enable row level security;
alter table public.check_ins            enable row level security;
alter table public.generated_workouts   enable row level security;
alter table public.generated_workout_exercises enable row level security;
alter table public.workout_logs         enable row level security;
alter table public.exercise_logs        enable row level security;
alter table public.plan_evolution_events enable row level security;
alter table public.safety_events        enable row level security;
alter table public.llm_call_logs        enable row level security;

-- =============================================================================
-- profiles — direct user_id match
-- =============================================================================
create policy "Users can view their own profile"
  on public.profiles for select
  using (user_id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles for update
  using (user_id = auth.uid());

-- Insert handled by trigger (no client insert needed)

-- =============================================================================
-- injury_intake — direct user_id match
-- =============================================================================
create policy "Users can view their own intake"
  on public.injury_intake for select
  using (user_id = auth.uid());

create policy "Users can insert their own intake"
  on public.injury_intake for insert
  with check (user_id = auth.uid());

-- Intake is immutable post-onboarding; no update policy

-- =============================================================================
-- injury_status — direct user_id match
-- =============================================================================
create policy "Users can view their own injury status"
  on public.injury_status for select
  using (user_id = auth.uid());

create policy "Users can insert their own injury status"
  on public.injury_status for insert
  with check (user_id = auth.uid());

create policy "Users can update their own injury status"
  on public.injury_status for update
  using (user_id = auth.uid());

-- =============================================================================
-- recovery_plans — direct user_id match
-- =============================================================================
create policy "Users can view their own plans"
  on public.recovery_plans for select
  using (user_id = auth.uid());

create policy "Users can insert their own plans"
  on public.recovery_plans for insert
  with check (user_id = auth.uid());

create policy "Users can update their own plans"
  on public.recovery_plans for update
  using (user_id = auth.uid());

-- =============================================================================
-- plan_phases — owned via recovery_plans
-- =============================================================================
create policy "Users can view phases of their own plans"
  on public.plan_phases for select
  using (
    exists (
      select 1 from public.recovery_plans rp
      where rp.id = plan_phases.plan_id
        and rp.user_id = auth.uid()
    )
  );

create policy "Users can insert phases into their own plans"
  on public.plan_phases for insert
  with check (
    exists (
      select 1 from public.recovery_plans rp
      where rp.id = plan_phases.plan_id
        and rp.user_id = auth.uid()
    )
  );

create policy "Users can update phases in their own plans"
  on public.plan_phases for update
  using (
    exists (
      select 1 from public.recovery_plans rp
      where rp.id = plan_phases.plan_id
        and rp.user_id = auth.uid()
    )
  );

-- =============================================================================
-- phase_exercises — owned via plan_phases → recovery_plans
-- =============================================================================
create policy "Users can view phase exercises for their own plans"
  on public.phase_exercises for select
  using (
    exists (
      select 1 from public.plan_phases pp
      join public.recovery_plans rp on rp.id = pp.plan_id
      where pp.id = phase_exercises.phase_id
        and rp.user_id = auth.uid()
    )
  );

create policy "Users can insert phase exercises into their own plans"
  on public.phase_exercises for insert
  with check (
    exists (
      select 1 from public.plan_phases pp
      join public.recovery_plans rp on rp.id = pp.plan_id
      where pp.id = phase_exercises.phase_id
        and rp.user_id = auth.uid()
    )
  );

-- =============================================================================
-- exercises — public read; no client writes
-- =============================================================================
create policy "Anyone can view exercises"
  on public.exercises for select
  using (true);

-- No insert/update/delete policies for exercises — admin-only via service role

-- =============================================================================
-- sessions — direct user_id match
-- =============================================================================
create policy "Users can view their own sessions"
  on public.sessions for select
  using (user_id = auth.uid());

create policy "Users can insert their own sessions"
  on public.sessions for insert
  with check (user_id = auth.uid());

create policy "Users can update their own sessions"
  on public.sessions for update
  using (user_id = auth.uid());

-- =============================================================================
-- check_ins — direct user_id match
-- =============================================================================
create policy "Users can view their own check-ins"
  on public.check_ins for select
  using (user_id = auth.uid());

create policy "Users can insert their own check-ins"
  on public.check_ins for insert
  with check (user_id = auth.uid());

-- =============================================================================
-- generated_workouts — owned via sessions
-- =============================================================================
create policy "Users can view workouts for their own sessions"
  on public.generated_workouts for select
  using (
    exists (
      select 1 from public.sessions s
      where s.id = generated_workouts.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can insert workouts for their own sessions"
  on public.generated_workouts for insert
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = generated_workouts.session_id
        and s.user_id = auth.uid()
    )
  );

-- =============================================================================
-- generated_workout_exercises — owned via generated_workouts → sessions
-- =============================================================================
create policy "Users can view exercises for their own workouts"
  on public.generated_workout_exercises for select
  using (
    exists (
      select 1 from public.generated_workouts gw
      join public.sessions s on s.id = gw.session_id
      where gw.id = generated_workout_exercises.generated_workout_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can insert exercises for their own workouts"
  on public.generated_workout_exercises for insert
  with check (
    exists (
      select 1 from public.generated_workouts gw
      join public.sessions s on s.id = gw.session_id
      where gw.id = generated_workout_exercises.generated_workout_id
        and s.user_id = auth.uid()
    )
  );

-- =============================================================================
-- workout_logs — direct user_id match
-- =============================================================================
create policy "Users can view their own workout logs"
  on public.workout_logs for select
  using (user_id = auth.uid());

create policy "Users can insert their own workout logs"
  on public.workout_logs for insert
  with check (user_id = auth.uid());

create policy "Users can update their own workout logs"
  on public.workout_logs for update
  using (user_id = auth.uid());

-- =============================================================================
-- exercise_logs — owned via workout_logs
-- =============================================================================
create policy "Users can view their own exercise logs"
  on public.exercise_logs for select
  using (
    exists (
      select 1 from public.workout_logs wl
      where wl.id = exercise_logs.workout_log_id
        and wl.user_id = auth.uid()
    )
  );

create policy "Users can insert their own exercise logs"
  on public.exercise_logs for insert
  with check (
    exists (
      select 1 from public.workout_logs wl
      where wl.id = exercise_logs.workout_log_id
        and wl.user_id = auth.uid()
    )
  );

-- =============================================================================
-- plan_evolution_events — direct user_id match
-- =============================================================================
create policy "Users can view their own evolution events"
  on public.plan_evolution_events for select
  using (user_id = auth.uid());

create policy "Users can insert their own evolution events"
  on public.plan_evolution_events for insert
  with check (user_id = auth.uid());

create policy "Users can update their own evolution events"
  on public.plan_evolution_events for update
  using (user_id = auth.uid());

-- =============================================================================
-- safety_events — direct user_id match
-- =============================================================================
create policy "Users can view their own safety events"
  on public.safety_events for select
  using (user_id = auth.uid());

create policy "Users can insert their own safety events"
  on public.safety_events for insert
  with check (user_id = auth.uid());

create policy "Users can update their own safety events"
  on public.safety_events for update
  using (user_id = auth.uid());

-- =============================================================================
-- llm_call_logs — users can only view their own; edge functions use service role
-- =============================================================================
create policy "Users can view their own LLM call logs"
  on public.llm_call_logs for select
  using (user_id = auth.uid());

-- No client insert — all inserts done server-side via service role in edge functions
