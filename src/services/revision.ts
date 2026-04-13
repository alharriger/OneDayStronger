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

  if (error) return { planId: null, summary: null, error: error.message };
  if (data?.error) return { planId: null, summary: null, error: data.error };

  return {
    planId: data?.planId ?? null,
    summary: data?.summary ?? null,
    error: null,
  };
}
