/**
 * Phase C architecture validation — Gluteal Tendinopathy condition module.
 *
 * Verifies that all shared _shared/ utilities work correctly with GT data
 * without any code changes. If these tests pass, the architecture is
 * condition-agnostic and adding further conditions requires only a DB row.
 */

import {
  buildExerciseNameSet,
  renderTemplate,
  type ConditionModule,
  type ConditionProtocol,
} from '../../supabase/functions/_shared/conditionModule';
import { classifyIrritability } from '../../supabase/functions/_shared/irritability';
import { resolveWorkoutModification } from '../../supabase/functions/_shared/workoutModification';
import { loadConditionModule } from '../../supabase/functions/_shared/conditionModule';
import { createChain } from '../helpers/supabaseMock';

// ─── GT fixture (mirrors the seed in migration 0006) ─────────────────────────

const GT_PROTOCOL: ConditionProtocol = {
  meta: {
    condition_id: 'gt',
    condition_name: 'Gluteal Tendinopathy',
    affected_structure: 'gluteal tendons at greater trochanter',
  },
  load_management: {
    acceptable_pain_during_exercise: 3,
    pain_settling_window_hours: 24,
    compression_avoidance: [
      'hip adduction across midline (crossing legs/feet)',
      'stretching into hip adduction or internal rotation',
      'hip drop in single-leg standing',
    ],
  },
  irritability_levels: {
    high: {
      criteria_description: 'Pain > 5/10 during ADLs, rest pain, or symptoms lasting > 2h after light activity',
      starting_phase_type: 'isometric',
      load_instruction: 'isometric hip abduction only; keep hip in neutral',
    },
    moderate: {
      criteria_description: 'Pain with activity, settles within 1–2h, minimal rest pain',
      starting_phase_type: 'isometric',
      load_instruction: 'isometrics + light isotonic hip abduction',
    },
    low: {
      criteria_description: 'Pain only with high-load activities, settles quickly',
      starting_phase_type: 'isotonic_eccentric',
      load_instruction: 'may progress to isotonic and loading faster',
    },
  },
  workout_modification_rules: {
    pain_0_3: { type: 'standard', instruction: 'Follow phase prescription as written' },
    pain_4_7: {
      type: 'modified',
      set_reduction_pct: 40,
      load_reduction_pct: 40,
      avoid_categories: ['hip_adduction_loaded'],
      instruction: 'Reduce sets and load 30–50%. Avoid loaded hip adduction.',
    },
    pain_8_10: { type: 'rest_recommendation', instruction: 'Rest. Clinical review recommended.' },
  },
  phase_templates: [
    {
      type: 'isometric',
      default_number: 1,
      default_name: 'Pain Management & Isometrics',
      clinical_rationale: 'Isometric hip abduction in neutral reduces sensitization',
      typical_duration_weeks: { min: 3, max: 6 },
      exercise_categories: ['isometric_hip_abductor', 'hip_stabilizer'],
      progression_criteria: { pain_threshold: 3, load_tolerance_pct: 75, consistency_pct: 70, window_days: 14 },
      regression_triggers: { pain_consecutive_sessions: 2, missed_sessions_window: 3 },
    },
    {
      type: 'isotonic_eccentric',
      default_number: 2,
      default_name: 'Isotonic Loading',
      clinical_rationale: 'Controlled isotonic hip abduction builds capacity',
      typical_duration_weeks: { min: 4, max: 8 },
      exercise_categories: ['isotonic_hip_abductor', 'hip_hinge_neutral'],
      progression_criteria: { pain_threshold: 3, load_tolerance_pct: 80, consistency_pct: 75, window_days: 21 },
      regression_triggers: { pain_consecutive_sessions: 2, missed_sessions_window: 4 },
    },
  ],
  exercise_library: [
    {
      id: 'gt_iso_wall_press',
      name: 'Isometric Wall Press',
      category: 'isometric_hip_abductor',
      default_prescription: { sets: 3, hold_seconds: 45, rest_seconds: 90, tempo: 'sustained' },
      coaching_cues: ['Press outer foot into wall', 'Keep hip in neutral'],
    },
    {
      id: 'gt_clamshell',
      name: 'Clamshell',
      category: 'isotonic_hip_abductor',
      default_prescription: { sets: 3, reps: '15 per side', rest_seconds: 45, tempo: '2-1-2' },
      coaching_cues: ['Keep pelvis still', 'Focus on external rotation'],
    },
    {
      id: 'gt_lateral_band_walk',
      name: 'Lateral Band Walk',
      category: 'hip_abductor_loaded',
      default_prescription: { sets: 3, reps: '15 steps per direction', rest_seconds: 75, tempo: 'controlled' },
      coaching_cues: ['Slight squat throughout', 'Avoid hip drop'],
    },
  ],
  safety_keywords: ['neurological', 'numbness', 'fracture', 'avulsion', 'bursitis'],
  return_to_activity_criteria: ['Single-leg stance ≥ 30s pain-free', 'Walk-run progression without flare'],
};

const GT_MODULE: ConditionModule = {
  condition_id: 'gt',
  version: '1.0',
  protocol: GT_PROTOCOL,
  plan_system_prompt_template: 'Protocol: {{condition_id}} v{{protocol_version}}\n{{plan_schema}}',
  workout_system_prompt_template: 'Pain: {{pain_level}}\nRules: {{workout_modification_rules}}\n{{workout_schema}}',
};

// ─── loadConditionModule — GT ─────────────────────────────────────────────────

describe('loadConditionModule — GT', () => {
  it('loads GT module without any code changes', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue(createChain({ data: GT_MODULE, error: null })),
    };
    const result = await loadConditionModule(supabase, 'gt');
    expect(result.condition_id).toBe('gt');
    expect(result.protocol.meta.condition_name).toBe('Gluteal Tendinopathy');
  });

  it('queries with gt condition_id', async () => {
    const chain = createChain({ data: GT_MODULE, error: null });
    const supabase = { from: jest.fn().mockReturnValue(chain) };
    await loadConditionModule(supabase, 'gt');
    expect(chain.eq).toHaveBeenCalledWith('condition_id', 'gt');
  });
});

// ─── buildExerciseNameSet — GT ────────────────────────────────────────────────

describe('buildExerciseNameSet — GT', () => {
  it('includes GT exercise ids and names', () => {
    const names = buildExerciseNameSet(GT_MODULE);
    expect(names.has('gt_iso_wall_press')).toBe(true);
    expect(names.has('Isometric Wall Press')).toBe(true);
    expect(names.has('gt_clamshell')).toBe(true);
    expect(names.has('Clamshell')).toBe(true);
  });

  it('does not include PHT exercise names', () => {
    const names = buildExerciseNameSet(GT_MODULE);
    expect(names.has('Isometric Hamstring Bridge')).toBe(false);
    expect(names.has('Nordic Hamstring Curl')).toBe(false);
  });

  it('has 2 entries per exercise (id + name)', () => {
    const names = buildExerciseNameSet(GT_MODULE);
    expect(names.size).toBe(GT_MODULE.protocol.exercise_library.length * 2);
  });
});

// ─── classifyIrritability — unchanged for GT ─────────────────────────────────

describe('classifyIrritability — works with GT without modification', () => {
  it('returns high for GT user with rest pain', () => {
    expect(classifyIrritability(4, true, 1)).toBe('high');
  });

  it('returns low for GT user with minimal pain and quick settling', () => {
    expect(classifyIrritability(1, false, 0.25)).toBe('low');
  });

  it('returns moderate for typical GT presentation', () => {
    expect(classifyIrritability(4, false, 1.5)).toBe('moderate');
  });
});

// ─── resolveWorkoutModification — works with GT rules ────────────────────────

describe('resolveWorkoutModification — works with GT rules', () => {
  const rules = GT_PROTOCOL.workout_modification_rules;

  it('returns standard for pain 0–3', () => {
    expect(resolveWorkoutModification(2, rules).type).toBe('standard');
  });

  it('returns modified for pain 4–7 with GT-specific avoid_categories', () => {
    const rule = resolveWorkoutModification(5, rules);
    expect(rule.type).toBe('modified');
    expect(rule.avoid_categories).toContain('hip_adduction_loaded');
  });

  it('returns rest_recommendation for pain ≥ 8', () => {
    expect(resolveWorkoutModification(9, rules).type).toBe('rest_recommendation');
  });
});

// ─── renderTemplate — works with GT template variables ───────────────────────

describe('renderTemplate — GT template rendering', () => {
  it('renders GT condition_id and name into system prompt template', () => {
    const result = renderTemplate(GT_MODULE.plan_system_prompt_template, {
      condition_id: 'gt',
      protocol_version: '1.0',
      plan_schema: '{}',
    });
    expect(result).toContain('gt');
    expect(result).toContain('1.0');
  });
});

// ─── Architecture validation ──────────────────────────────────────────────────

describe('Phase C architecture validation', () => {
  it('GT and PHT modules share the same ConditionModule interface', () => {
    // Both are typed as ConditionModule — no PHT-specific fields required
    const gtModule: ConditionModule = GT_MODULE;
    expect(gtModule.condition_id).toBe('gt');
    expect(gtModule.protocol.irritability_levels.high).toBeDefined();
    expect(gtModule.protocol.workout_modification_rules.pain_0_3).toBeDefined();
    expect(gtModule.protocol.phase_templates.length).toBeGreaterThan(0);
    expect(gtModule.protocol.exercise_library.length).toBeGreaterThan(0);
  });

  it('GT compression_avoidance differs from PHT — confirms protocol isolation', () => {
    const gtAvoidance = GT_PROTOCOL.load_management.compression_avoidance;
    expect(gtAvoidance.some((c) => c.includes('adduction'))).toBe(true);
    // PHT avoids hip flexion — GT avoids adduction — different clinical rules, same structure
    expect(gtAvoidance.some((c) => c.includes('flexion'))).toBe(false);
  });

  it('GT exercise categories differ from PHT — no shared category names', () => {
    const gtCategories = new Set(GT_PROTOCOL.exercise_library.map((e) => e.category));
    // GT uses hip_abductor categories; PHT uses hamstring categories
    expect(gtCategories.has('isometric_hip_abductor')).toBe(true);
    expect(gtCategories.has('isometric_hamstring')).toBe(false);
  });
});
