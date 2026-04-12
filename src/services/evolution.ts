import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type PlanEvolutionEvent = Database['public']['Tables']['plan_evolution_events']['Row'];

export async function getUnseenEvents(userId: string): Promise<PlanEvolutionEvent[]> {
  const { data, error } = await supabase
    .from('plan_evolution_events')
    .select('*')
    .eq('user_id', userId)
    .eq('seen', false)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data;
}

export async function markEventSeen(eventId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('plan_evolution_events')
    .update({ seen: true })
    .eq('id', eventId);

  return { error: error ? error.message : null };
}

export async function getEvolutionHistory(
  userId: string,
  limit = 20
): Promise<PlanEvolutionEvent[]> {
  const { data, error } = await supabase
    .from('plan_evolution_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data;
}
