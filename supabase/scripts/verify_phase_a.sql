-- =============================================================================
-- Phase A Stability Verification
-- One Day Stronger — condition_modules feature
-- =============================================================================
-- Run this in the Supabase SQL editor after applying migrations 0004 + 0005
-- and deploying the updated edge functions.
-- Each section prints a label and result so you can scan top to bottom.
-- =============================================================================

-- ─── 1. Condition module seeded ───────────────────────────────────────────────

SELECT
  '1. CONDITION MODULE' AS check_name,
  condition_id,
  version,
  is_active,
  jsonb_array_length(protocol->'exercise_library') AS exercise_count,
  jsonb_array_length(protocol->'phase_templates')  AS phase_count,
  length(plan_system_prompt_template) > 0           AS has_plan_template,
  length(workout_system_prompt_template) > 0        AS has_workout_template,
  CASE
    WHEN condition_id = 'pht'
     AND version = '1.0'
     AND is_active = true
     AND jsonb_array_length(protocol->'exercise_library') = 12
     AND jsonb_array_length(protocol->'phase_templates') = 4
    THEN '✓ PASS'
    ELSE '✗ FAIL — check migration 0005'
  END AS result
FROM public.condition_modules;

-- ─── 2. recovery_plans columns exist ─────────────────────────────────────────

SELECT
  '2. RECOVERY_PLANS COLUMNS' AS check_name,
  column_name,
  data_type,
  column_default,
  CASE
    WHEN column_name = 'condition_id'     AND column_default LIKE '%pht%' THEN '✓ PASS'
    WHEN column_name = 'protocol_version' AND data_type = 'text'          THEN '✓ PASS'
    ELSE '✗ FAIL — check migration 0004'
  END AS result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'recovery_plans'
  AND column_name IN ('condition_id', 'protocol_version')
ORDER BY column_name;

-- ─── 3. Most recent plan has condition tracking ───────────────────────────────

SELECT
  '3. LATEST PLAN TRACKING' AS check_name,
  id,
  condition_id,
  protocol_version,
  prompt_version,
  generated_at,
  CASE
    WHEN condition_id = 'pht'
     AND protocol_version IS NOT NULL
     AND prompt_version LIKE 'generate-plan-v3%'
    THEN '✓ PASS'
    WHEN condition_id IS NULL OR prompt_version NOT LIKE 'generate-plan-v3%'
    THEN '✗ FAIL — plan generated before migration or old function still deployed'
    ELSE '⚠ PARTIAL — condition_id set but check protocol_version'
  END AS result
FROM public.recovery_plans
ORDER BY generated_at DESC
LIMIT 1;

-- ─── 4. LLM call log — prompt versions ───────────────────────────────────────

SELECT
  '4. LLM CALL LOG' AS check_name,
  edge_function,
  prompt_version,
  success,
  latency_ms,
  called_at,
  CASE
    WHEN edge_function = 'generate-plan'    AND prompt_version LIKE 'generate-plan-v3%'    THEN '✓ PASS'
    WHEN edge_function = 'generate-workout' AND prompt_version LIKE 'generate-workout-v2%' THEN '✓ PASS'
    WHEN edge_function = 'revise-plan'      AND prompt_version LIKE 'revise-plan-v2%'      THEN '✓ PASS'
    ELSE '✗ FAIL — old prompt version; redeploy the edge function'
  END AS result
FROM public.llm_call_logs
WHERE called_at > now() - interval '1 hour'
ORDER BY called_at DESC
LIMIT 10;

-- ─── 5. Exercise library spot-check ──────────────────────────────────────────
-- Verifies the 4 phase types and a sample of exercises are present in the seed.

SELECT
  '5. EXERCISE LIBRARY SPOT-CHECK' AS check_name,
  ex->>'id'       AS exercise_id,
  ex->>'name'     AS exercise_name,
  ex->>'category' AS category,
  '✓ present'     AS result
FROM public.condition_modules,
     jsonb_array_elements(protocol->'exercise_library') AS ex
WHERE condition_id = 'pht'
  AND ex->>'id' IN (
    'pht_iso_hamstring_bridge',
    'pht_nordic_hamstring_curl',
    'pht_deadlift',
    'pht_sprint_drill_a_march'
  )
ORDER BY ex->>'id';
-- Expected: 4 rows (one from each phase type)

-- ─── 6. Summary ──────────────────────────────────────────────────────────────

SELECT
  '6. SUMMARY' AS check_name,
  (SELECT count(*) FROM public.condition_modules WHERE is_active = true)           AS active_modules,
  (SELECT count(*) FROM public.recovery_plans WHERE condition_id IS NOT NULL)      AS plans_with_condition,
  (SELECT count(*) FROM public.recovery_plans WHERE protocol_version IS NOT NULL)  AS plans_with_version,
  (SELECT count(*) FROM public.llm_call_logs WHERE prompt_version LIKE '%-v3%' OR prompt_version LIKE '%-v2%') AS new_version_calls;
