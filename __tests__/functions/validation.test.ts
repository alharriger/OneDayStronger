/**
 * Unit tests for _shared/validation.ts (Deno-side hand-rolled validators).
 *
 * Focuses on the exercise library validation added in Step 7 — the new
 * validExerciseNames param on validateGeneratePlanResponse. Core schema
 * contract tests live in __tests__/schemas/llmContracts.test.ts.
 */

import {
  validateGeneratePlanResponse,
  validateGenerateWorkoutResponse,
} from '../../supabase/functions/_shared/validation';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_EXERCISE = {
  name: 'Isometric Hamstring Bridge',
  sets: 3,
  reps: '45s hold',
  load_target: 'bodyweight',
  tempo: 'controlled',
  rest_seconds: 90,
  notes: '',
};

const VALID_PHASE = {
  phase_number: 1,
  name: 'Pain Management & Isometrics',
  description: 'Isometric loading to reduce sensitization.',
  plain_language_summary: 'Hold each exercise for the prescribed time.',
  estimated_duration_weeks: 4,
  progression_criteria: { pain_threshold: 3, load_tolerance_pct: 75, consistency_pct: 70, window_days: 14 },
  regression_criteria: { pain_consecutive_sessions: 2, missed_sessions_window: 3 },
  exercises: [VALID_EXERCISE],
};

const VALID_PLAN = {
  plain_language_summary: 'Your 3-phase plan will take approximately 16 weeks.',
  phases: [
    VALID_PHASE,
    { ...VALID_PHASE, phase_number: 2, name: 'Eccentric Loading' },
  ],
};

const LIBRARY_NAMES = new Set([
  'pht_iso_hamstring_bridge',
  'Isometric Hamstring Bridge',
  'pht_clam_shell',
  'Clam Shell',
  'Nordic Hamstring Curl',
  'pht_nordic_hamstring_curl',
]);

// ─── validateGeneratePlanResponse — schema validation ─────────────────────────

describe('validateGeneratePlanResponse — schema', () => {
  it('accepts a valid 2-phase plan', () => {
    const result = validateGeneratePlanResponse(VALID_PLAN);
    expect(result.phases).toHaveLength(2);
    expect(result.plain_language_summary).toBeTruthy();
  });

  it('rejects non-object input', () => {
    expect(() => validateGeneratePlanResponse(null)).toThrow();
    expect(() => validateGeneratePlanResponse('string')).toThrow();
    expect(() => validateGeneratePlanResponse(42)).toThrow();
  });

  it('rejects missing plain_language_summary', () => {
    const { plain_language_summary: _, ...rest } = VALID_PLAN;
    expect(() => validateGeneratePlanResponse(rest)).toThrow('plain_language_summary');
  });

  it('rejects fewer than 2 phases', () => {
    expect(() => validateGeneratePlanResponse({ ...VALID_PLAN, phases: [VALID_PHASE] })).toThrow('phases');
  });

  it('rejects more than 6 phases', () => {
    const phases = Array.from({ length: 7 }, (_, i) => ({ ...VALID_PHASE, phase_number: i + 1 }));
    expect(() => validateGeneratePlanResponse({ ...VALID_PLAN, phases })).toThrow('phases');
  });

  it('rejects exercise with empty name', () => {
    const badPlan = {
      ...VALID_PLAN,
      phases: [
        { ...VALID_PHASE, exercises: [{ ...VALID_EXERCISE, name: '' }] },
        { ...VALID_PHASE, phase_number: 2, name: 'p2' },
      ],
    };
    expect(() => validateGeneratePlanResponse(badPlan)).toThrow('name');
  });

  it('defaults missing notes to empty string', () => {
    const { notes: _, ...exerciseWithoutNotes } = VALID_EXERCISE;
    const plan = {
      ...VALID_PLAN,
      phases: [
        { ...VALID_PHASE, exercises: [exerciseWithoutNotes] },
        { ...VALID_PHASE, phase_number: 2, name: 'p2' },
      ],
    };
    const result = validateGeneratePlanResponse(plan);
    expect(result.phases[0].exercises[0].notes).toBe('');
  });
});

// ─── validateGeneratePlanResponse — exercise library validation ───────────────

describe('validateGeneratePlanResponse — exercise library validation', () => {
  it('passes when all exercises are in the library (by name)', () => {
    const result = validateGeneratePlanResponse(VALID_PLAN, LIBRARY_NAMES);
    expect(result.phases).toHaveLength(2);
  });

  it('passes when exercises match by id instead of display name', () => {
    const planWithId = {
      ...VALID_PLAN,
      phases: [
        { ...VALID_PHASE, exercises: [{ ...VALID_EXERCISE, name: 'pht_iso_hamstring_bridge' }] },
        { ...VALID_PHASE, phase_number: 2, name: 'p2', exercises: [{ ...VALID_EXERCISE, name: 'pht_clam_shell' }] },
      ],
    };
    expect(() => validateGeneratePlanResponse(planWithId, LIBRARY_NAMES)).not.toThrow();
  });

  it('rejects an exercise name not in the library', () => {
    const planWithHallucination = {
      ...VALID_PLAN,
      phases: [
        { ...VALID_PHASE, exercises: [{ ...VALID_EXERCISE, name: 'Hamstring Stretch' }] },
        { ...VALID_PHASE, phase_number: 2, name: 'p2' },
      ],
    };
    expect(() => validateGeneratePlanResponse(planWithHallucination, LIBRARY_NAMES)).toThrow(
      'not in the condition module exercise library',
    );
  });

  it('includes the bad exercise name in the error message', () => {
    const planWithHallucination = {
      ...VALID_PLAN,
      phases: [
        { ...VALID_PHASE, exercises: [{ ...VALID_EXERCISE, name: 'Invented Exercise' }] },
        { ...VALID_PHASE, phase_number: 2, name: 'p2' },
      ],
    };
    expect(() => validateGeneratePlanResponse(planWithHallucination, LIBRARY_NAMES)).toThrow(
      '"Invented Exercise"',
    );
  });

  it('skips library check when validExerciseNames is not provided', () => {
    const planWithUnknownExercise = {
      ...VALID_PLAN,
      phases: [
        { ...VALID_PHASE, exercises: [{ ...VALID_EXERCISE, name: 'Any Exercise Name' }] },
        { ...VALID_PHASE, phase_number: 2, name: 'p2' },
      ],
    };
    expect(() => validateGeneratePlanResponse(planWithUnknownExercise)).not.toThrow();
  });

  it('catches a hallucinated exercise in a later phase', () => {
    const planWithLateHallucination = {
      ...VALID_PLAN,
      phases: [
        VALID_PHASE,
        {
          ...VALID_PHASE,
          phase_number: 2,
          name: 'Eccentric Loading',
          exercises: [{ ...VALID_EXERCISE, name: 'Hamstring Stretch' }],
        },
      ],
    };
    expect(() => validateGeneratePlanResponse(planWithLateHallucination, LIBRARY_NAMES)).toThrow(
      'not in the condition module exercise library',
    );
  });
});

// ─── validateGenerateWorkoutResponse ─────────────────────────────────────────

describe('validateGenerateWorkoutResponse', () => {
  const VALID_WORKOUT_EXERCISE = {
    exercise_name: 'Isometric Hamstring Bridge',
    sets: 3,
    reps: '45s hold',
    load: 'bodyweight',
    tempo: 'controlled',
    rest_seconds: 90,
    notes: '',
  };

  it('accepts a standard workout', () => {
    const result = validateGenerateWorkoutResponse({
      workout_type: 'standard',
      plain_language_explanation: 'Today you will follow your phase prescription.',
      exercises: [VALID_WORKOUT_EXERCISE],
    });
    expect(result.workout_type).toBe('standard');
    expect(result.exercises).toHaveLength(1);
  });

  it('accepts a modified workout', () => {
    const result = validateGenerateWorkoutResponse({
      workout_type: 'modified',
      plain_language_explanation: 'Pain is moderate, volume reduced.',
      exercises: [{ ...VALID_WORKOUT_EXERCISE, sets: 2 }],
    });
    expect(result.workout_type).toBe('modified');
  });

  it('accepts rest_recommendation with empty exercises array', () => {
    const result = validateGenerateWorkoutResponse({
      workout_type: 'rest_recommendation',
      plain_language_explanation: 'Rest today.',
      exercises: [],
    });
    expect(result.exercises).toHaveLength(0);
  });

  it('rejects rest_recommendation with non-empty exercises', () => {
    expect(() => validateGenerateWorkoutResponse({
      workout_type: 'rest_recommendation',
      plain_language_explanation: 'Rest today.',
      exercises: [VALID_WORKOUT_EXERCISE],
    })).toThrow('rest_recommendation');
  });

  it('rejects unknown workout_type', () => {
    expect(() => validateGenerateWorkoutResponse({
      workout_type: 'easy_day',
      plain_language_explanation: 'Test',
      exercises: [],
    })).toThrow('workout_type');
  });

  it('rejects empty plain_language_explanation', () => {
    expect(() => validateGenerateWorkoutResponse({
      workout_type: 'standard',
      plain_language_explanation: '',
      exercises: [VALID_WORKOUT_EXERCISE],
    })).toThrow('plain_language_explanation');
  });

  it('defaults missing notes to empty string', () => {
    const { notes: _, ...exerciseWithoutNotes } = VALID_WORKOUT_EXERCISE;
    const result = validateGenerateWorkoutResponse({
      workout_type: 'standard',
      plain_language_explanation: 'Today is a standard session.',
      exercises: [exerciseWithoutNotes],
    });
    expect(result.exercises[0].notes).toBe('');
  });
});
