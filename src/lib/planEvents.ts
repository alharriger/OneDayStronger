/**
 * Minimal in-process event bus for plan state changes.
 *
 * When the user jumps to a different phase, plan.tsx calls notifyPlanChanged().
 * useTodayWorkout subscribes via onPlanChanged() and re-initializes so Today
 * reflects the new phase without requiring a full app restart or navigation.
 */

type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribe to plan-changed events. Returns an unsubscribe function. */
export function onPlanChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Emit a plan-changed event — all current subscribers are called synchronously. */
export function notifyPlanChanged(): void {
  listeners.forEach((fn) => fn());
}
