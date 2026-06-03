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

export interface CompletionHistory {
  /** Consecutive completed days ending at today. */
  streakCount: number;
  /** ISO date strings for completed sessions in the past 14 days. */
  recentCompletedDates: string[];
}

/**
 * Returns the user's current streak and a 14-day completion history
 * for the streak bar. Looks back 60 days to compute the full streak.
 */
export async function getCompletionHistory(userId: string): Promise<CompletionHistory> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 59);
  const cutoffDate = cutoff.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('sessions')
    .select('scheduled_date')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('scheduled_date', cutoffDate)
    .order('scheduled_date', { ascending: false });

  if (error || !data || data.length === 0) {
    return { streakCount: 0, recentCompletedDates: [] };
  }

  const completedSet = new Set(data.map((s) => s.scheduled_date));
  const today = new Date().toISOString().split('T')[0];

  // Streak: walk backwards from today while each day is completed
  let streak = 0;
  const cursor = new Date(today);
  while (completedSet.has(cursor.toISOString().split('T')[0])) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Collect completed dates from the past 14 days for the bar
  const recentCompletedDates: string[] = [];
  const recent = new Date(today);
  for (let i = 0; i < 14; i++) {
    const d = recent.toISOString().split('T')[0];
    if (completedSet.has(d)) recentCompletedDates.push(d);
    recent.setDate(recent.getDate() - 1);
  }

  return { streakCount: streak, recentCompletedDates };
}
