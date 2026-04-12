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
