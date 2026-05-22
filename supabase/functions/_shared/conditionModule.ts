/**
 * Condition module loader — shared by all edge functions.
 *
 * Loads a versioned clinical protocol from the condition_modules table.
 * Each call hits the DB (no in-process cache) — Deno isolates are
 * short-lived so there is nothing to cache across invocations.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExerciseLibraryEntry {
  id: string;
  name: string;
  category: string;
  default_prescription: Record<string, unknown>;
  high_irritability_modification?: Record<string, unknown>;
  coaching_cues: string[];
}

export interface PhaseTemplate {
  type: string;
  default_number: number;
  default_name: string;
  clinical_rationale: string;
  typical_duration_weeks: { min: number; max: number };
  exercise_categories: string[];
  progression_criteria: {
    pain_threshold: number;
    load_tolerance_pct: number;
    consistency_pct: number;
    window_days: number;
  };
  regression_triggers: {
    pain_consecutive_sessions: number;
    missed_sessions_window: number;
  };
}

export interface IrritabilityLevel {
  criteria_description: string;
  starting_phase_type: string;
  load_instruction: string;
}

export interface WorkoutModificationRule {
  type: 'standard' | 'modified' | 'rest_recommendation';
  set_reduction_pct?: number;
  load_reduction_pct?: number;
  avoid_categories?: string[];
  instruction: string;
}

export interface ConditionProtocol {
  meta: {
    condition_id: string;
    condition_name: string;
    affected_structure: string;
  };
  load_management: {
    acceptable_pain_during_exercise: number;
    pain_settling_window_hours: number;
    compression_avoidance: string[];
  };
  irritability_levels: {
    high: IrritabilityLevel;
    moderate: IrritabilityLevel;
    low: IrritabilityLevel;
  };
  workout_modification_rules: {
    pain_0_3: WorkoutModificationRule;
    pain_4_7: WorkoutModificationRule;
    pain_8_10: WorkoutModificationRule;
  };
  phase_templates: PhaseTemplate[];
  exercise_library: ExerciseLibraryEntry[];
  safety_keywords: string[];
  return_to_activity_criteria: string[];
}

export interface ConditionModule {
  condition_id: string;
  version: string;
  protocol: ConditionProtocol;
  plan_system_prompt_template: string;
  workout_system_prompt_template: string;
}

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Load a condition module by ID. Throws if the condition is not found or
 * inactive — callers should catch and return a 500 with a user-facing error.
 */
export async function loadConditionModule(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  conditionId: string,
): Promise<ConditionModule> {
  const { data, error } = await supabase
    .from('condition_modules')
    .select('condition_id, version, protocol, plan_system_prompt_template, workout_system_prompt_template')
    .eq('condition_id', conditionId)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new Error(
      `Condition module not found or inactive: ${conditionId}. DB error: ${error?.message ?? 'no row returned'}`,
    );
  }

  return data as ConditionModule;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a set of valid exercise identifiers (id and name) from the module's
 * exercise_library. Used by schema validation to reject hallucinated exercises.
 */
export function buildExerciseNameSet(module: ConditionModule): Set<string> {
  const names = new Set<string>();
  for (const ex of module.protocol.exercise_library) {
    names.add(ex.id);
    names.add(ex.name);
  }
  return names;
}

/**
 * Build a template string by substituting {{key}} placeholders with values.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}
