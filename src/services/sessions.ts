import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type Session = Database['public']['Tables']['sessions']['Row'];
type SessionInsert = Database['public']['Tables']['sessions']['Insert'];
type SessionUpdate = Database['public']['Tables']['sessions']['Update'];

function todayISODate(): string {
  return new Date().toISOString().split('T')[0];
}

export async function getTodaySession(userId: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('scheduled_date', todayISODate())
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

export async function createSession(
  data: SessionInsert
): Promise<{ session: Session | null; error: string | null }> {
  const { data: inserted, error } = await supabase
    .from('sessions')
    .insert(data)
    .select('*')
    .single();

  if (error) return { session: null, error: error.message };
  return { session: inserted, error: null };
}

export async function updateSession(
  sessionId: string,
  data: SessionUpdate
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('sessions')
    .update(data)
    .eq('id', sessionId);

  return { error: error ? error.message : null };
}

export async function getRecentSessions(userId: string, limit = 20): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('scheduled_date', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data;
}
