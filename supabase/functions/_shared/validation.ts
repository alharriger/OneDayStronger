/**
 * LLM response validation schemas — Deno-side mirrors of ai_docs/llm_contracts.md.
 * Uses hand-rolled validation (no Zod dependency in edge functions) to keep cold
 * starts fast and avoid npm resolution issues.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProgressionCriteria {
  pain_threshold: number;
  load_tolerance_pct: number;
  consistency_pct: number;
  window_days: number;
}

export interface RegressionCriteria {
  pain_consecutive_sessions: number;
  missed_sessions_window: number;
}

export interface PlanExercise {
  name: string;
  sets: number;
  reps: string;
  load_target: string;
  tempo: string;
  rest_seconds: number;
  notes: string;
}

export interface PlanPhase {
  phase_number: number;
  name: string;
  description: string;
  plain_language_summary: string;
  estimated_duration_weeks: number;
  progression_criteria: ProgressionCriteria;
  regression_criteria: RegressionCriteria;
  exercises: PlanExercise[];
}

export interface GeneratePlanResponse {
  plain_language_summary: string;
  phases: PlanPhase[];
}

export interface WorkoutExercise {
  exercise_name: string;
  sets: number;
  reps: string;
  load: string;
  tempo: string;
  rest_seconds: number;
  notes: string;
}

export interface GenerateWorkoutResponse {
  workout_type: 'standard' | 'modified' | 'rest_recommendation';
  plain_language_explanation: string;
  exercises: WorkoutExercise[];
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

// ─── generate-plan-v1 ─────────────────────────────────────────────────────────

function validateProgressionCriteria(c: unknown): ProgressionCriteria {
  if (!c || typeof c !== 'object') throw new Error('progression_criteria must be an object');
  const obj = c as Record<string, unknown>;
  if (!isInt(obj.pain_threshold) || obj.pain_threshold < 0 || obj.pain_threshold > 4)
    throw new Error('pain_threshold must be int 0–4');
  if (!isInt(obj.load_tolerance_pct) || obj.load_tolerance_pct < 50 || obj.load_tolerance_pct > 100)
    throw new Error('load_tolerance_pct must be int 50–100');
  if (!isInt(obj.consistency_pct) || obj.consistency_pct < 60 || obj.consistency_pct > 100)
    throw new Error('consistency_pct must be int 60–100');
  if (!isInt(obj.window_days) || obj.window_days < 7 || obj.window_days > 30)
    throw new Error('window_days must be int 7–30');
  return obj as unknown as ProgressionCriteria;
}

function validateRegressionCriteria(c: unknown): RegressionCriteria {
  if (!c || typeof c !== 'object') throw new Error('regression_criteria must be an object');
  const obj = c as Record<string, unknown>;
  if (!isInt(obj.pain_consecutive_sessions) || obj.pain_consecutive_sessions < 2 || obj.pain_consecutive_sessions > 4)
    throw new Error('pain_consecutive_sessions must be int 2–4');
  if (!isInt(obj.missed_sessions_window) || obj.missed_sessions_window < 1 || obj.missed_sessions_window > 10)
    throw new Error('missed_sessions_window must be int 1–10');
  return obj as unknown as RegressionCriteria;
}

function validatePlanExercise(e: unknown, index: number): PlanExercise {
  if (!e || typeof e !== 'object') throw new Error(`exercises[${index}] must be an object`);
  const obj = e as Record<string, unknown>;
  if (!isNonEmptyString(obj.name)) throw new Error(`exercises[${index}].name must be a non-empty string`);
  if (!isInt(obj.sets) || obj.sets < 1 || obj.sets > 10) throw new Error(`exercises[${index}].sets must be int 1–10`);
  if (!isNonEmptyString(obj.reps)) throw new Error(`exercises[${index}].reps must be a non-empty string`);
  if (!isNonEmptyString(obj.load_target)) throw new Error(`exercises[${index}].load_target must be a non-empty string`);
  if (!isNonEmptyString(obj.tempo)) throw new Error(`exercises[${index}].tempo must be a non-empty string`);
  if (!isInt(obj.rest_seconds) || obj.rest_seconds < 0 || obj.rest_seconds > 600)
    throw new Error(`exercises[${index}].rest_seconds must be int 0–600`);
  if (!isString(obj.notes)) obj.notes = '';
  return obj as unknown as PlanExercise;
}

function validatePlanPhase(p: unknown, index: number): PlanPhase {
  if (!p || typeof p !== 'object') throw new Error(`phases[${index}] must be an object`);
  const obj = p as Record<string, unknown>;
  if (!isInt(obj.phase_number) || obj.phase_number < 1) throw new Error(`phases[${index}].phase_number must be a positive int`);
  if (!isNonEmptyString(obj.name)) throw new Error(`phases[${index}].name must be a non-empty string`);
  if (!isNonEmptyString(obj.description)) throw new Error(`phases[${index}].description must be a non-empty string`);
  if (!isNonEmptyString(obj.plain_language_summary)) throw new Error(`phases[${index}].plain_language_summary must be a non-empty string`);
  if (!isInt(obj.estimated_duration_weeks) || obj.estimated_duration_weeks < 1 || obj.estimated_duration_weeks > 26)
    throw new Error(`phases[${index}].estimated_duration_weeks must be int 1–26`);

  const progressionCriteria = validateProgressionCriteria(obj.progression_criteria);
  const regressionCriteria = validateRegressionCriteria(obj.regression_criteria);

  if (!Array.isArray(obj.exercises)) throw new Error(`phases[${index}].exercises must be an array`);
  if (obj.exercises.length < 1 || obj.exercises.length > 8)
    throw new Error(`phases[${index}].exercises must have 1–8 items`);
  const exercises = obj.exercises.map((e, ei) => validatePlanExercise(e, ei));

  return { ...obj, progression_criteria: progressionCriteria, regression_criteria: regressionCriteria, exercises } as unknown as PlanPhase;
}

export function validateGeneratePlanResponse(raw: unknown): GeneratePlanResponse {
  if (!raw || typeof raw !== 'object') throw new Error('Response must be a JSON object');
  const obj = raw as Record<string, unknown>;
  if (!isNonEmptyString(obj.plain_language_summary))
    throw new Error('plain_language_summary must be a non-empty string');
  if (!Array.isArray(obj.phases)) throw new Error('phases must be an array');
  if (obj.phases.length < 2 || obj.phases.length > 6)
    throw new Error(`phases must have 2–6 items, got ${obj.phases.length}`);
  const phases = obj.phases.map((p, i) => validatePlanPhase(p, i));
  return { plain_language_summary: obj.plain_language_summary, phases };
}

// ─── generate-workout-v1 ──────────────────────────────────────────────────────

function validateWorkoutExercise(e: unknown, index: number): WorkoutExercise {
  if (!e || typeof e !== 'object') throw new Error(`exercises[${index}] must be an object`);
  const obj = e as Record<string, unknown>;
  if (!isNonEmptyString(obj.exercise_name)) throw new Error(`exercises[${index}].exercise_name must be a non-empty string`);
  if (!isInt(obj.sets) || obj.sets < 0 || obj.sets > 10) throw new Error(`exercises[${index}].sets must be int 0–10`);
  if (!isNonEmptyString(obj.reps)) throw new Error(`exercises[${index}].reps must be a non-empty string`);
  if (!isNonEmptyString(obj.load)) throw new Error(`exercises[${index}].load must be a non-empty string`);
  if (!isNonEmptyString(obj.tempo)) throw new Error(`exercises[${index}].tempo must be a non-empty string`);
  if (!isInt(obj.rest_seconds) || obj.rest_seconds < 0 || obj.rest_seconds > 600)
    throw new Error(`exercises[${index}].rest_seconds must be int 0–600`);
  if (!isString(obj.notes)) obj.notes = '';
  return obj as unknown as WorkoutExercise;
}

export function validateGenerateWorkoutResponse(raw: unknown): GenerateWorkoutResponse {
  if (!raw || typeof raw !== 'object') throw new Error('Response must be a JSON object');
  const obj = raw as Record<string, unknown>;
  const validTypes = ['standard', 'modified', 'rest_recommendation'];
  if (!validTypes.includes(obj.workout_type as string))
    throw new Error(`workout_type must be one of ${validTypes.join(', ')}`);
  if (!isNonEmptyString(obj.plain_language_explanation))
    throw new Error('plain_language_explanation must be a non-empty string');
  if (!Array.isArray(obj.exercises)) throw new Error('exercises must be an array');

  const exercises = obj.exercises.map((e, i) => validateWorkoutExercise(e, i));

  if (obj.workout_type === 'rest_recommendation' && exercises.length !== 0)
    throw new Error('rest_recommendation must have empty exercises array');

  return {
    workout_type: obj.workout_type as GenerateWorkoutResponse['workout_type'],
    plain_language_explanation: obj.plain_language_explanation as string,
    exercises,
  };
}
