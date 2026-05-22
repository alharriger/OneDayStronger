/**
 * Unit tests for _shared/conditionModule.ts
 *
 * loadConditionModule, buildExerciseNameSet, classifyIrritability,
 * resolveWorkoutModification, and renderTemplate are all pure TS with no
 * Deno-specific imports so they run directly in Jest.
 */

import {
  loadConditionModule,
  buildExerciseNameSet,
  classifyIrritability,
  resolveWorkoutModification,
  renderTemplate,
  type ConditionModule,
  type ConditionProtocol,
} from '../../supabase/functions/_shared/conditionModule';
import { createChain } from '../helpers/supabaseMock';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_PROTOCOL: ConditionProtocol = {
  meta: {
    condition_id: 'pht',
    condition_name: 'Proximal Hamstring Tendinopathy',
    affected_structure: 'proximal hamstring tendon',
  },
  load_management: {
    acceptable_pain_during_exercise: 3,
    pain_settling_window_hours: 24,
    compression_avoidance: ['hip flexion > 70°'],
  },
  irritability_levels: {
    high: {
      criteria_description: 'Pain > 5/10 during ADLs',
      starting_phase_type: 'isometric',
      load_instruction: 'isometrics only',
    },
    moderate: {
      criteria_description: 'Pain with activity, settles within 1–2h',
      starting_phase_type: 'isometric',
      load_instruction: 'isometrics + light isotonic',
    },
    low: {
      criteria_description: 'Pain only with high-load activities',
      starting_phase_type: 'isotonic_eccentric',
      load_instruction: 'may progress faster',
    },
  },
  workout_modification_rules: {
    pain_0_3: { type: 'standard', instruction: 'Follow prescription' },
    pain_4_7: {
      type: 'modified',
      set_reduction_pct: 40,
      load_reduction_pct: 40,
      avoid_categories: ['hip_flexion_dominant'],
      instruction: 'Reduce sets and load',
    },
    pain_8_10: { type: 'rest_recommendation', instruction: 'Rest today' },
  },
  phase_templates: [
    {
      type: 'isometric',
      default_number: 1,
      default_name: 'Pain Management',
      clinical_rationale: 'Static loading reduces sensitization',
      typical_duration_weeks: { min: 3, max: 6 },
      exercise_categories: ['isometric_hamstring'],
      progression_criteria: { pain_threshold: 3, load_tolerance_pct: 75, consistency_pct: 70, window_days: 14 },
      regression_triggers: { pain_consecutive_sessions: 2, missed_sessions_window: 3 },
    },
  ],
  exercise_library: [
    {
      id: 'pht_iso_hamstring_bridge',
      name: 'Isometric Hamstring Bridge',
      category: 'isometric_hamstring',
      default_prescription: { sets: 3, hold_seconds: 45, rest_seconds: 90, tempo: 'sustained' },
      coaching_cues: ['Press heel firmly into surface'],
    },
    {
      id: 'pht_clam_shell',
      name: 'Clam Shell',
      category: 'hip_abductor',
      default_prescription: { sets: 3, reps: '15 per side', rest_seconds: 45, tempo: '2-1-2' },
      coaching_cues: ['Keep pelvis stable'],
    },
  ],
  safety_keywords: ['neurological', 'numbness', 'fracture'],
  return_to_activity_criteria: ['Complete functional phase without flare'],
};

const MOCK_MODULE: ConditionModule = {
  condition_id: 'pht',
  version: '1.0',
  protocol: MOCK_PROTOCOL,
  plan_system_prompt_template: 'Protocol: {{condition_id}} v{{protocol_version}}\n{{plan_schema}}',
  workout_system_prompt_template: 'Pain: {{pain_level}}\nRules: {{workout_modification_rules}}\n{{workout_schema}}',
};

// ─── loadConditionModule ───────────────────────────────────────────────────────

describe('loadConditionModule', () => {
  it('returns the module when found and active', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue(createChain({ data: MOCK_MODULE, error: null })),
    };

    const result = await loadConditionModule(supabase, 'pht');
    expect(result.condition_id).toBe('pht');
    expect(result.version).toBe('1.0');
    expect(result.protocol.meta.condition_name).toBe('Proximal Hamstring Tendinopathy');
  });

  it('throws when no row is returned', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue(createChain({ data: null, error: null })),
    };

    await expect(loadConditionModule(supabase, 'unknown')).rejects.toThrow(
      'Condition module not found or inactive: unknown',
    );
  });

  it('throws when a DB error is returned', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue(
        createChain({ data: null, error: { message: 'connection refused' } }),
      ),
    };

    await expect(loadConditionModule(supabase, 'pht')).rejects.toThrow('connection refused');
  });

  it('queries the correct table and filters', async () => {
    const chain = createChain({ data: MOCK_MODULE, error: null });
    const supabase = { from: jest.fn().mockReturnValue(chain) };

    await loadConditionModule(supabase, 'pht');

    expect(supabase.from).toHaveBeenCalledWith('condition_modules');
    expect(chain.eq).toHaveBeenCalledWith('condition_id', 'pht');
    expect(chain.eq).toHaveBeenCalledWith('is_active', true);
  });
});

// ─── buildExerciseNameSet ──────────────────────────────────────────────────────

describe('buildExerciseNameSet', () => {
  it('includes both ids and names for every entry', () => {
    const names = buildExerciseNameSet(MOCK_MODULE);

    expect(names.has('pht_iso_hamstring_bridge')).toBe(true);
    expect(names.has('Isometric Hamstring Bridge')).toBe(true);
    expect(names.has('pht_clam_shell')).toBe(true);
    expect(names.has('Clam Shell')).toBe(true);
  });

  it('does not include unrelated strings', () => {
    const names = buildExerciseNameSet(MOCK_MODULE);
    expect(names.has('Nordic Hamstring Curl')).toBe(false);
    expect(names.has('Deadlift')).toBe(false);
  });

  it('returns a set with 2 entries per exercise (id + name)', () => {
    const names = buildExerciseNameSet(MOCK_MODULE);
    // 2 exercises × 2 identifiers each
    expect(names.size).toBe(4);
  });
});

// ─── classifyIrritability ─────────────────────────────────────────────────────

describe('classifyIrritability', () => {
  describe('high irritability', () => {
    it('classifies pain > 5 as high', () => {
      expect(classifyIrritability(6, false, 1)).toBe('high');
      expect(classifyIrritability(8, false, 0.5)).toBe('high');
      expect(classifyIrritability(10, false, 0)).toBe('high');
    });

    it('classifies rest pain as high regardless of pain score', () => {
      expect(classifyIrritability(3, true, 0.5)).toBe('high');
      expect(classifyIrritability(1, true, 0.25)).toBe('high');
    });

    it('classifies symptoms settling > 2h as high', () => {
      expect(classifyIrritability(4, false, 3)).toBe('high');
      expect(classifyIrritability(2, false, 2.5)).toBe('high');
    });
  });

  describe('low irritability', () => {
    it('classifies pain ≤ 2 + no rest pain + settles quickly as low', () => {
      expect(classifyIrritability(2, false, 0.5)).toBe('low');
      expect(classifyIrritability(0, false, 0)).toBe('low');
      expect(classifyIrritability(1, false, 0.25)).toBe('low');
    });

    it('does not classify pain 3 as low even with other low factors', () => {
      expect(classifyIrritability(3, false, 0)).toBe('moderate');
    });
  });

  describe('moderate irritability', () => {
    it('classifies pain 3–5 without other high factors as moderate', () => {
      expect(classifyIrritability(3, false, 1)).toBe('moderate');
      expect(classifyIrritability(5, false, 1)).toBe('moderate');
    });

    it('classifies pain ≤ 2 but slow settling as moderate', () => {
      expect(classifyIrritability(2, false, 1)).toBe('moderate');
    });
  });
});

// ─── resolveWorkoutModification ───────────────────────────────────────────────

describe('resolveWorkoutModification', () => {
  const rules = MOCK_PROTOCOL.workout_modification_rules;

  it('returns standard rule for pain 0', () => {
    const rule = resolveWorkoutModification(0, rules);
    expect(rule.type).toBe('standard');
  });

  it('returns standard rule for pain 3', () => {
    const rule = resolveWorkoutModification(3, rules);
    expect(rule.type).toBe('standard');
  });

  it('returns modified rule for pain 4', () => {
    const rule = resolveWorkoutModification(4, rules);
    expect(rule.type).toBe('modified');
    expect(rule.set_reduction_pct).toBe(40);
  });

  it('returns modified rule for pain 7', () => {
    const rule = resolveWorkoutModification(7, rules);
    expect(rule.type).toBe('modified');
  });

  it('returns rest_recommendation for pain 8', () => {
    const rule = resolveWorkoutModification(8, rules);
    expect(rule.type).toBe('rest_recommendation');
  });

  it('returns rest_recommendation for pain 10', () => {
    const rule = resolveWorkoutModification(10, rules);
    expect(rule.type).toBe('rest_recommendation');
  });
});

// ─── renderTemplate ───────────────────────────────────────────────────────────

describe('renderTemplate', () => {
  it('replaces a single placeholder', () => {
    const result = renderTemplate('Hello {{name}}!', { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('replaces multiple different placeholders', () => {
    const result = renderTemplate('{{a}} and {{b}}', { a: 'foo', b: 'bar' });
    expect(result).toBe('foo and bar');
  });

  it('replaces the same placeholder appearing multiple times', () => {
    const result = renderTemplate('{{x}} then {{x}}', { x: 'again' });
    expect(result).toBe('again then again');
  });

  it('leaves unknown placeholders in place', () => {
    const result = renderTemplate('{{known}} and {{unknown}}', { known: 'yes' });
    expect(result).toBe('yes and {{unknown}}');
  });

  it('handles empty string values', () => {
    const result = renderTemplate('prefix{{gap}}suffix', { gap: '' });
    expect(result).toBe('prefixsuffix');
  });

  it('does not alter text with no placeholders', () => {
    const result = renderTemplate('no placeholders here', {});
    expect(result).toBe('no placeholders here');
  });
});
