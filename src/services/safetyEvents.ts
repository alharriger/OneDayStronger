import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type SafetyEvent = Database['public']['Tables']['safety_events']['Row'];
type SafetyEventInsert = Database['public']['Tables']['safety_events']['Insert'];

export async function createSafetyEvent(
  data: SafetyEventInsert
): Promise<{ event: SafetyEvent | null; error: string | null }> {
  const { data: inserted, error } = await supabase
    .from('safety_events')
    .insert(data)
    .select('*')
    .single();

  if (error) return { event: null, error: error.message };
  return { event: inserted, error: null };
}

export async function acknowledgeSafetyEvent(
  eventId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('safety_events')
    .update({
      professional_care_acknowledged: true,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', eventId);

  return { error: error ? error.message : null };
}

export async function getPendingSafetyEvent(userId: string): Promise<SafetyEvent | null> {
  const { data, error } = await supabase
    .from('safety_events')
    .select('*')
    .eq('user_id', userId)
    .eq('professional_care_acknowledged', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

export async function hasPendingSafetyEvent(userId: string): Promise<boolean> {
  const event = await getPendingSafetyEvent(userId);
  return event !== null;
}
