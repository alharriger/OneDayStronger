-- =============================================================================
-- One Day Stronger — Condition Modules
-- =============================================================================
-- Replaces hardcoded clinical knowledge in edge functions with a versioned,
-- structured DB table. Each row is a self-contained rehabilitation protocol
-- for one condition (PHT, gluteal tendinopathy, etc.).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. condition_modules — versioned clinical protocols
-- ---------------------------------------------------------------------------
create table public.condition_modules (
  id                              uuid primary key default gen_random_uuid(),
  condition_id                    text not null unique,
  version                         text not null,
  protocol                        jsonb not null,
  plan_system_prompt_template     text not null,
  workout_system_prompt_template  text not null,
  is_active                       boolean not null default true,
  created_at                      timestamptz not null default now()
);

-- RLS enabled with no policies — blocks anon/authenticated key access entirely.
-- The service role key used by edge functions bypasses RLS, so no policy is needed there.
alter table public.condition_modules enable row level security;

comment on table public.condition_modules is
  'Versioned rehabilitation protocols. One row per condition. Edge functions load '
  'the active module at runtime — no redeploy needed for protocol updates.';

-- ---------------------------------------------------------------------------
-- 2. Extend recovery_plans with condition tracking
-- ---------------------------------------------------------------------------
alter table public.recovery_plans
  add column condition_id      text not null default 'pht',
  add column protocol_version  text;

comment on column public.recovery_plans.condition_id is
  'Foreign key into condition_modules.condition_id — identifies which protocol '
  'was used to generate this plan.';

comment on column public.recovery_plans.protocol_version is
  'Snapshot of condition_modules.version at plan-generation time. Allows '
  'evolve-plan and revise-plan to reload the exact protocol the plan was built on.';
