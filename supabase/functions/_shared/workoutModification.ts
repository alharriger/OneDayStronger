/**
 * Workout modification resolver — condition-agnostic deterministic logic.
 *
 * Resolves the workout modification rule for a given pain level using the
 * condition module's workout_modification_rules. The pain thresholds
 * (0–3 standard, 4–7 modified, 8–10 rest) are universal across tendinopathy
 * conditions — only the specific instructions and categories differ per module.
 *
 * Called before any LLM invocation so the LLM is told exactly which
 * workout_type to generate rather than deciding it itself.
 */

import type { WorkoutModificationRule, ConditionProtocol } from './conditionModule.ts';

export type { WorkoutModificationRule };

/**
 * Resolve the workout modification rule from today's pain level.
 * Pain thresholds: 0–3 → standard, 4–7 → modified, 8–10 → rest_recommendation.
 */
export function resolveWorkoutModification(
  painLevel: number,
  rules: ConditionProtocol['workout_modification_rules'],
): WorkoutModificationRule {
  if (painLevel <= 3) return rules.pain_0_3;
  if (painLevel <= 7) return rules.pain_4_7;
  return rules.pain_8_10;
}
