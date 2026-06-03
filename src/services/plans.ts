import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type RecoveryPlan = Database['public']['Tables']['recovery_plans']['Row'];
type PlanPhase = Database['public']['Tables']['plan_phases']['Row'];
type PhaseExercise = Database['public']['Tables']['phase_exercises']['Row'];
type Exercise = Database['public']['Tables']['exercises']['Row'];

export interface PlanPhaseWithExercises extends PlanPhase {
  phase_exercises: Array<PhaseExercise & { exercises: Exercise | null }>;
}

export interface ActivePlan extends RecoveryPlan {
  plan_phases: PlanPhaseWithExercises[];
}

export async function getActivePlan(userId: string): Promise<ActivePlan | null> {
  const { data, error } = await supabase
    .from('recovery_plans')
    .select(`
      *,
      plan_phases (
        *,
        phase_exercises (
          *,
          exercises (*)
        )
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data as ActivePlan;
}

export async function getActivePhase(userId: string): Promise<PlanPhaseWithExercises | null> {
  const plan = await getActivePlan(userId);
  if (!plan) return null;

  const activePhase = plan.plan_phases.find((p) => p.status === 'active');
  return activePhase ?? null;
}

export async function getPlanPhases(planId: string): Promise<PlanPhase[]> {
  const { data, error } = await supabase
    .from('plan_phases')
    .select('*')
    .eq('plan_id', planId)
    .order('phase_number', { ascending: true });

  if (error) return [];
  return data;
}

export async function updatePlanStatus(
  planId: string,
  status: RecoveryPlan['status']
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('recovery_plans')
    .update({ status })
    .eq('id', planId);

  return { error: error ? error.message : null };
}

export interface JumpToPhaseParams {
  planId: string;
  userId: string;
  /** The phase the user wants to start at. */
  targetPhaseId: string;
  targetPhaseNumber: number;
  /** The phase currently marked active, if any. */
  fromPhaseId: string | null;
  fromPhaseNumber: number | null;
}

/**
 * Lets a user jump to any phase — forward (progression) or backward (regression).
 *
 * Forward jump steps:
 *  1. Marks all phases before the target as `completed`.
 *  2. Marks the target phase as `active`.
 *  3. Marks all phases after the target as `upcoming`.
 *  4. Inserts a user-initiated event.
 *  5. Updates today's session to the target phase and clears any generated workout.
 *
 * Backward jump does the same but logs the event as a `regression`.
 */
export async function jumpToPhase(
  params: JumpToPhaseParams
): Promise<{ error: string | null }> {
  const { planId, userId, targetPhaseId, targetPhaseNumber, fromPhaseId, fromPhaseNumber } =
    params;

  // Guard: cannot jump to the phase you're already on.
  if (fromPhaseNumber !== null && targetPhaseNumber === fromPhaseNumber) {
    return { error: 'You are already on that phase.' };
  }

  const isProgression = fromPhaseNumber === null || targetPhaseNumber > fromPhaseNumber;
  const eventType = isProgression ? 'progression' : 'regression';

  // 1. Mark phases before target as completed.
  const { error: priorError } = await supabase
    .from('plan_phases')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('plan_id', planId)
    .lt('phase_number', targetPhaseNumber);

  if (priorError) return { error: priorError.message };

  // 2. Mark the target phase active.
  const { error: targetError } = await supabase
    .from('plan_phases')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', targetPhaseId);

  if (targetError) return { error: targetError.message };

  // 3. Mark phases after target as upcoming (needed when jumping backward).
  const { error: upcomingError } = await supabase
    .from('plan_phases')
    .update({ status: 'upcoming', started_at: null, completed_at: null })
    .eq('plan_id', planId)
    .gt('phase_number', targetPhaseNumber);

  if (upcomingError) return { error: upcomingError.message };

  // 4. Insert a user-initiated event.
  const { error: eventError } = await supabase
    .from('plan_evolution_events')
    .insert({
      user_id: userId,
      plan_id: planId,
      from_phase_id: fromPhaseId,
      to_phase_id: targetPhaseId,
      event_type: eventType,
      triggered_by: 'user_initiated',
      rationale: isProgression
        ? 'You set your starting point based on prior physical therapy progress.'
        : 'You moved back to an earlier phase to rebuild your foundation.',
    });

  if (eventError) return { error: eventError.message };

  // 5. Update today's session to the target phase and clear any generated workout.
  const today = new Date().toISOString().split('T')[0];
  const { data: todaySession } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('scheduled_date', today)
    .limit(1)
    .single();

  if (todaySession) {
    await supabase
      .from('sessions')
      .update({ plan_phase_id: targetPhaseId })
      .eq('id', todaySession.id);

    // Delete today's workout so it is regenerated for the new phase.
    // The check-in is preserved — the user's pain levels are still valid
    // regardless of which phase they jumped to.
    await supabase
      .from('generated_workouts')
      .delete()
      .eq('session_id', todaySession.id);
  }

  return { error: null };
}
