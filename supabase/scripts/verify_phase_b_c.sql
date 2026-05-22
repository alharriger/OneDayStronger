-- =============================================================================
-- One Day Stronger — Phase B/C Verification Script
-- =============================================================================
-- Verifies:
--   Phase B: _shared/irritability.ts + workoutModification.ts extracted
--             (no DB changes; verified via LLM call log prompt_version)
--   Phase C: GT condition module seeded, architecture isolation confirmed
--
-- Run after deploying Phase B/C edge functions and completing a fresh
-- PHT onboarding on a test account.
-- Expected: all checks show "PASS".
-- =============================================================================

-- ─── 1. Both condition modules active ────────────────────────────────────────
SELECT
  'check_1_modules' AS check_name,
  CASE
    WHEN COUNT(*) = 2 THEN 'PASS — both pht + gt active'
    ELSE 'FAIL — expected 2 active modules, got ' || COUNT(*)::text
  END AS result
FROM public.condition_modules
WHERE is_active = true
  AND condition_id IN ('pht', 'gt');

-- ─── 2. PHT exercise library completeness ────────────────────────────────────
SELECT
  'check_2_pht_exercises' AS check_name,
  CASE
    WHEN jsonb_array_length(protocol->'exercise_library') >= 10
    THEN 'PASS — ' || jsonb_array_length(protocol->'exercise_library')::text || ' exercises'
    ELSE 'FAIL — only ' || jsonb_array_length(protocol->'exercise_library')::text || ' exercises'
  END AS result
FROM public.condition_modules
WHERE condition_id = 'pht';

-- ─── 3. GT exercise library completeness ─────────────────────────────────────
SELECT
  'check_3_gt_exercises' AS check_name,
  CASE
    WHEN jsonb_array_length(protocol->'exercise_library') >= 10
    THEN 'PASS — ' || jsonb_array_length(protocol->'exercise_library')::text || ' exercises'
    ELSE 'FAIL — only ' || jsonb_array_length(protocol->'exercise_library')::text || ' exercises'
  END AS result
FROM public.condition_modules
WHERE condition_id = 'gt';

-- ─── 4. Protocol isolation: PHT avoids flexion, GT avoids adduction ──────────
SELECT
  'check_4_compression_isolation' AS check_name,
  CASE
    WHEN pht_avoid ILIKE '%flexion%' AND gt_avoid ILIKE '%adduction%'
    THEN 'PASS — PHT: ' || pht_avoid || ' | GT: ' || gt_avoid
    ELSE 'FAIL — avoidance rules not isolated correctly'
  END AS result
FROM (
  SELECT
    (SELECT protocol->'load_management'->'compression_avoidance'->>0
     FROM public.condition_modules WHERE condition_id = 'pht') AS pht_avoid,
    (SELECT protocol->'load_management'->'compression_avoidance'->>0
     FROM public.condition_modules WHERE condition_id = 'gt') AS gt_avoid
) sub;

-- ─── 5. GT has 4 phase templates ─────────────────────────────────────────────
SELECT
  'check_5_gt_phases' AS check_name,
  CASE
    WHEN jsonb_array_length(protocol->'phase_templates') = 4
    THEN 'PASS — 4 phase templates'
    ELSE 'FAIL — expected 4 phase templates, got ' ||
         jsonb_array_length(protocol->'phase_templates')::text
  END AS result
FROM public.condition_modules
WHERE condition_id = 'gt';

-- ─── 6. Exercise category isolation: GT uses hip_abductor, PHT uses hamstring ─
SELECT
  'check_6_category_isolation' AS check_name,
  CASE
    WHEN pht_has_hamstring AND NOT pht_has_hip_abductor
     AND gt_has_hip_abductor AND NOT gt_has_hamstring
    THEN 'PASS — category namespaces fully isolated'
    ELSE 'FAIL — unexpected category overlap between PHT and GT'
  END AS result
FROM (
  SELECT
    EXISTS (
      SELECT 1 FROM public.condition_modules cm,
        jsonb_array_elements(protocol->'exercise_library') AS ex
      WHERE cm.condition_id = 'pht'
        AND ex->>'category' ILIKE '%hamstring%'
    ) AS pht_has_hamstring,
    EXISTS (
      SELECT 1 FROM public.condition_modules cm,
        jsonb_array_elements(protocol->'exercise_library') AS ex
      WHERE cm.condition_id = 'pht'
        AND ex->>'category' ILIKE '%hip_abductor%'
    ) AS pht_has_hip_abductor,
    EXISTS (
      SELECT 1 FROM public.condition_modules cm,
        jsonb_array_elements(protocol->'exercise_library') AS ex
      WHERE cm.condition_id = 'gt'
        AND ex->>'category' ILIKE '%hip_abductor%'
    ) AS gt_has_hip_abductor,
    EXISTS (
      SELECT 1 FROM public.condition_modules cm,
        jsonb_array_elements(protocol->'exercise_library') AS ex
      WHERE cm.condition_id = 'gt'
        AND ex->>'category' ILIKE '%hamstring%'
    ) AS gt_has_hamstring
) sub;

-- ─── 7. New plans carry condition_id + protocol_version (Phase A still good) ──
SELECT
  'check_7_plans_tracked' AS check_name,
  CASE
    WHEN COUNT(*) > 0 THEN 'PASS — ' || COUNT(*)::text || ' plan(s) with condition_id + version'
    ELSE 'INFO — no plans yet (run onboarding on test account first)'
  END AS result
FROM public.recovery_plans
WHERE condition_id IS NOT NULL
  AND protocol_version IS NOT NULL;

-- ─── 8. LLM call logs: Phase B/C prompt versions present ─────────────────────
SELECT
  'check_8_prompt_versions' AS check_name,
  prompt_version,
  COUNT(*) AS calls,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) AS successes
FROM public.llm_call_logs
WHERE prompt_version IN ('generate-plan-v3', 'generate-workout-v2', 'revise-plan-v2')
GROUP BY prompt_version
ORDER BY prompt_version;

-- ─── 9. Irritability-level spot-check in PHT protocol ────────────────────────
SELECT
  'check_9_pht_irritability' AS check_name,
  CASE
    WHEN (protocol->'irritability_levels'->'high'->>'starting_phase_type') = 'isometric'
     AND (protocol->'irritability_levels'->'low'->>'starting_phase_type') = 'isotonic_eccentric'
    THEN 'PASS — high=isometric, low=isotonic_eccentric'
    ELSE 'FAIL — unexpected irritability config in PHT'
  END AS result
FROM public.condition_modules
WHERE condition_id = 'pht';

-- ─── 10. Irritability-level spot-check in GT protocol ────────────────────────
SELECT
  'check_10_gt_irritability' AS check_name,
  CASE
    WHEN (protocol->'irritability_levels'->'high'->>'starting_phase_type') = 'isometric'
     AND (protocol->'irritability_levels'->'low'->>'starting_phase_type') = 'isotonic_eccentric'
    THEN 'PASS — high=isometric, low=isotonic_eccentric'
    ELSE 'FAIL — unexpected irritability config in GT'
  END AS result
FROM public.condition_modules
WHERE condition_id = 'gt';
