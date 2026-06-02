import { supabase } from '@/lib/supabase';

export interface InjuryStatusUpdate {
  pain_level_baseline: number;
  current_symptoms: string;
  last_flare_date: string | null;
}

export async function invokeRevisePlan(
  injuryStatus: InjuryStatusUpdate,
): Promise<{ planId: string | null; summary: string | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('revise-plan', {
    body: { injuryStatus },
  });

  if (error || data?.error) {
    // Prefer the descriptive message from the response body over the generic SDK string
    const message = data?.error ?? error?.message ?? 'Could not revise plan. Please try again.';
    return { planId: null, summary: null, error: message };
  }

  return {
    planId: data?.planId ?? null,
    summary: data?.summary ?? null,
    error: null,
  };
}
