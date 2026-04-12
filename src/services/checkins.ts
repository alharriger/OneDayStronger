import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type CheckIn = Database['public']['Tables']['check_ins']['Row'];
type CheckInInsert = Database['public']['Tables']['check_ins']['Insert'];

export async function submitCheckIn(
  data: CheckInInsert
): Promise<{ checkIn: CheckIn | null; error: string | null }> {
  const { data: inserted, error } = await supabase
    .from('check_ins')
    .insert(data)
    .select('*')
    .single();

  if (error) return { checkIn: null, error: error.message };
  return { checkIn: inserted, error: null };
}

export async function getRecentCheckIns(userId: string, count = 3): Promise<CheckIn[]> {
  const { data, error } = await supabase
    .from('check_ins')
    .select('*')
    .eq('user_id', userId)
    .order('checked_in_at', { ascending: false })
    .limit(count);

  if (error) return [];
  return data;
}

export async function getTodayCheckIn(userId: string): Promise<CheckIn | null> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('check_ins')
    .select('*')
    .eq('user_id', userId)
    .gte('checked_in_at', todayStart.toISOString())
    .order('checked_in_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}
