/**
 * Irritability classifier — condition-agnostic deterministic logic.
 *
 * Classifies a user's irritability level from intake data without any
 * LLM call. The thresholds are derived from tendinopathy load management
 * principles common across conditions (PHT, gluteal, Achilles, patellar).
 *
 * Adding a new condition does not require changing this file — the output
 * ('high' | 'moderate' | 'low') maps into each condition module's
 * irritability_levels to get condition-specific instructions.
 */

/**
 * Classify irritability level deterministically from intake data.
 *
 *   high     — pain > 5 OR rest pain OR symptoms settle > 2h after light activity
 *   low      — pain ≤ 2 AND no rest pain AND symptoms settle ≤ 30 min
 *   moderate — everything else
 */
export function classifyIrritability(
  currentPain: number,
  hasRestPain: boolean,
  symptomsSettleHours: number,
): 'high' | 'moderate' | 'low' {
  if (currentPain > 5 || hasRestPain || symptomsSettleHours > 2) return 'high';
  if (currentPain <= 2 && !hasRestPain && symptomsSettleHours <= 0.5) return 'low';
  return 'moderate';
}
