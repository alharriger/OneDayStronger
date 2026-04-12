/**
 * LLM Contract Schema Tests
 *
 * These tests validate the Zod schemas documented in ai_docs/llm_contracts.md.
 * The schemas are defined here as the canonical client-side reference; they will
 * also be independently implemented in each Supabase edge function (Deno) for
 * Phase 3. Keep these in sync with llm_contracts.md.
 */

import { z } from 'zod';

// ─── Schemas (mirrors ai_docs/llm_contracts.md) ───────────────────────────────

const ProgressionCriteriaSchema = z.object({
  pain_threshold: z.number().int().min(0).max(4),
  load_tolerance_pct: z.number().int().min(50).max(100),
  consistency_pct: z.number().int().min(60).max(100),
  window_days: z.number().int().min(7).max(30),
});

const RegressionCriteriaSchema = z.object({
  pain_consecutive_sessions: z.number().int().min(2).max(4),
  missed_sessions_window: z.number().int().min(1).max(10),
});

const PlanExerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().min(1).max(10),
  reps: z.string().min(1),
  load_target: z.string().min(1),
  tempo: z.string().min(1),
  rest_seconds: z.number().int().min(0).max(600),
  notes: z.string(),
});

const PlanPhaseSchema = z.object({
  phase_number: z.number().int().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  plain_language_summary: z.string().min(1),
  estimated_duration_weeks: z.number().int().min(1).max(26),
  progression_criteria: ProgressionCriteriaSchema,
  regression_criteria: RegressionCriteriaSchema,
  exercises: z.array(PlanExerciseSchema).min(1).max(8),
});

const GeneratePlanResponseSchema = z.object({
  plain_language_summary: z.string().min(1),
  phases: z.array(PlanPhaseSchema).min(2).max(6),
});

const WorkoutExerciseSchema = z.object({
  exercise_name: z.string().min(1),
  sets: z.number().int().min(0).max(10),
  reps: z.string().min(1),
  load: z.string().min(1),
  tempo: z.string().min(1),
  rest_seconds: z.number().int().min(0).max(600),
  notes: z.string(),
});

const GenerateWorkoutResponseSchema = z.object({
  workout_type: z.enum(['standard', 'modified', 'rest_recommendation']),
  plain_language_explanation: z.string().min(1),
  exercises: z.array(WorkoutExerciseSchema),
}).refine(
  (data) => data.workout_type !== 'rest_recommendation' || data.exercises.length === 0,
  { message: 'rest_recommendation must have empty exercises array' }
);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const validPhase = {
  phase_number: 1,
  name: 'Pain Management & Isometrics',
  description: 'Focus on reducing irritability via isometric loading.',
  plain_language_summary: 'We start gently with isometric holds to calm down the tendon.',
  estimated_duration_weeks: 4,
  progression_criteria: {
    pain_threshold: 3,
    load_tolerance_pct: 75,
    consistency_pct: 80,
    window_days: 14,
  },
  regression_criteria: {
    pain_consecutive_sessions: 2,
    missed_sessions_window: 3,
  },
  exercises: [
    {
      name: 'Isometric Hip Extension',
      sets: 3,
      reps: '45s hold',
      load_target: 'bodyweight',
      tempo: 'controlled',
      rest_seconds: 90,
      notes: 'Keep pain ≤ 3/10',
    },
  ],
};

const validPlanResponse = {
  plain_language_summary: 'Your 16-week plan starts gently and builds progressive load.',
  phases: [validPhase, { ...validPhase, phase_number: 2, name: 'Eccentric Loading' }],
};

const validWorkoutExercise = {
  exercise_name: 'Nordic Curl',
  sets: 3,
  reps: '8',
  load: 'bodyweight',
  tempo: '3-1-3',
  rest_seconds: 120,
  notes: 'Slow eccentric, assist on concentric if needed',
};

// ─── generate-plan-v1 ─────────────────────────────────────────────────────────

describe('GeneratePlanResponseSchema (generate-plan-v1)', () => {
  describe('valid responses', () => {
    it('accepts a valid 2-phase plan', () => {
      const result = GeneratePlanResponseSchema.safeParse(validPlanResponse);
      expect(result.success).toBe(true);
    });

    it('accepts a 5-phase plan', () => {
      const phases = Array.from({ length: 5 }, (_, i) => ({
        ...validPhase,
        phase_number: i + 1,
        name: `Phase ${i + 1}`,
      }));
      const result = GeneratePlanResponseSchema.safeParse({
        plain_language_summary: 'Your plan.',
        phases,
      });
      expect(result.success).toBe(true);
    });

    it('accepts exercises with empty notes string', () => {
      const response = {
        ...validPlanResponse,
        phases: [{
          ...validPhase,
          exercises: [{ ...validPhase.exercises[0], notes: '' }],
        }, { ...validPhase, phase_number: 2, name: 'Phase 2' }],
      };
      const result = GeneratePlanResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid responses', () => {
    it('rejects missing plain_language_summary', () => {
      const { plain_language_summary: _, ...rest } = validPlanResponse;
      const result = GeneratePlanResponseSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects missing phases', () => {
      const result = GeneratePlanResponseSchema.safeParse({ plain_language_summary: 'ok' });
      expect(result.success).toBe(false);
    });

    it('rejects < 2 phases', () => {
      const result = GeneratePlanResponseSchema.safeParse({
        plain_language_summary: 'ok',
        phases: [validPhase],
      });
      expect(result.success).toBe(false);
    });

    it('rejects > 6 phases', () => {
      const phases = Array.from({ length: 7 }, (_, i) => ({ ...validPhase, phase_number: i + 1 }));
      const result = GeneratePlanResponseSchema.safeParse({
        plain_language_summary: 'ok',
        phases,
      });
      expect(result.success).toBe(false);
    });

    it('rejects pain_threshold > 4', () => {
      const badPhase = {
        ...validPhase,
        progression_criteria: { ...validPhase.progression_criteria, pain_threshold: 5 },
      };
      const result = GeneratePlanResponseSchema.safeParse({
        plain_language_summary: 'ok',
        phases: [badPhase, { ...validPhase, phase_number: 2, name: 'p2' }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects load_tolerance_pct < 50', () => {
      const badPhase = {
        ...validPhase,
        progression_criteria: { ...validPhase.progression_criteria, load_tolerance_pct: 40 },
      };
      const result = GeneratePlanResponseSchema.safeParse({
        plain_language_summary: 'ok',
        phases: [badPhase, { ...validPhase, phase_number: 2, name: 'p2' }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects phase with no exercises', () => {
      const badPhase = { ...validPhase, exercises: [] };
      const result = GeneratePlanResponseSchema.safeParse({
        plain_language_summary: 'ok',
        phases: [badPhase, { ...validPhase, phase_number: 2, name: 'p2' }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects phase with > 8 exercises', () => {
      const manyExercises = Array.from({ length: 9 }, (_, i) => ({
        ...validPhase.exercises[0],
        name: `Exercise ${i}`,
      }));
      const badPhase = { ...validPhase, exercises: manyExercises };
      const result = GeneratePlanResponseSchema.safeParse({
        plain_language_summary: 'ok',
        phases: [badPhase, { ...validPhase, phase_number: 2, name: 'p2' }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing exercise name', () => {
      const badExercise = { ...validPhase.exercises[0], name: '' };
      const badPhase = { ...validPhase, exercises: [badExercise] };
      const result = GeneratePlanResponseSchema.safeParse({
        plain_language_summary: 'ok',
        phases: [badPhase, { ...validPhase, phase_number: 2, name: 'p2' }],
      });
      expect(result.success).toBe(false);
    });
  });
});

// ─── generate-workout-v1 ──────────────────────────────────────────────────────

describe('GenerateWorkoutResponseSchema (generate-workout-v1)', () => {
  const standardWorkout = {
    workout_type: 'standard',
    plain_language_explanation: 'Today you\'ll do 3 exercises from your phase prescription.',
    exercises: [validWorkoutExercise],
  };

  const modifiedWorkout = {
    workout_type: 'modified',
    plain_language_explanation: 'Your pain is moderate today so we\'ve reduced volume.',
    exercises: [{ ...validWorkoutExercise, sets: 2 }],
  };

  const restRecommendation = {
    workout_type: 'rest_recommendation',
    plain_language_explanation: 'Your pain is high today. Rest is the best medicine right now.',
    exercises: [],
  };

  describe('valid responses', () => {
    it('accepts a standard workout with exercises', () => {
      const result = GenerateWorkoutResponseSchema.safeParse(standardWorkout);
      expect(result.success).toBe(true);
    });

    it('accepts a modified workout', () => {
      const result = GenerateWorkoutResponseSchema.safeParse(modifiedWorkout);
      expect(result.success).toBe(true);
    });

    it('accepts a rest_recommendation with empty exercises', () => {
      const result = GenerateWorkoutResponseSchema.safeParse(restRecommendation);
      expect(result.success).toBe(true);
    });

    it('accepts multiple exercises in a workout', () => {
      const result = GenerateWorkoutResponseSchema.safeParse({
        ...standardWorkout,
        exercises: [validWorkoutExercise, { ...validWorkoutExercise, exercise_name: 'Hip Thrust' }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('invalid responses', () => {
    it('rejects rest_recommendation with exercises in array', () => {
      const result = GenerateWorkoutResponseSchema.safeParse({
        ...restRecommendation,
        exercises: [validWorkoutExercise],
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid workout_type', () => {
      const result = GenerateWorkoutResponseSchema.safeParse({
        workout_type: 'easy_day',
        plain_language_explanation: 'Test',
        exercises: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing workout_type', () => {
      const { workout_type: _, ...rest } = standardWorkout;
      const result = GenerateWorkoutResponseSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects empty plain_language_explanation', () => {
      const result = GenerateWorkoutResponseSchema.safeParse({
        ...standardWorkout,
        plain_language_explanation: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects exercise with empty name', () => {
      const result = GenerateWorkoutResponseSchema.safeParse({
        ...standardWorkout,
        exercises: [{ ...validWorkoutExercise, exercise_name: '' }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects exercise with rest_seconds > 600', () => {
      const result = GenerateWorkoutResponseSchema.safeParse({
        ...standardWorkout,
        exercises: [{ ...validWorkoutExercise, rest_seconds: 700 }],
      });
      expect(result.success).toBe(false);
    });
  });
});
