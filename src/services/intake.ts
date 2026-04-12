import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type InjuryIntakeInsert = Database['public']['Tables']['injury_intake']['Insert'];
type InjuryIntakeRow = Database['public']['Tables']['injury_intake']['Row'];
type InjuryStatusInsert = Database['public']['Tables']['injury_status']['Insert'];
type InjuryStatusRow = Database['public']['Tables']['injury_status']['Row'];
type InjuryStatusUpdate = Database['public']['Tables']['injury_status']['Update'];

export async function saveInjuryIntake(
  data: InjuryIntakeInsert
): Promise<{ id: string | null; error: string | null }> {
  const { data: inserted, error } = await supabase
    .from('injury_intake')
    .insert(data)
    .select('id')
    .single();

  if (error) return { id: null, error: error.message };
  return { id: inserted.id, error: null };
}

export async function getInjuryIntake(userId: string): Promise<InjuryIntakeRow | null> {
  const { data, error } = await supabase
    .from('injury_intake')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

export async function saveInjuryStatus(
  data: InjuryStatusInsert
): Promise<{ id: string | null; error: string | null }> {
  const { data: inserted, error } = await supabase
    .from('injury_status')
    .insert(data)
    .select('id')
    .single();

  if (error) return { id: null, error: error.message };
  return { id: inserted.id, error: null };
}

export async function getInjuryStatus(userId: string): Promise<InjuryStatusRow | null> {
  const { data, error } = await supabase
    .from('injury_status')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

export async function updateInjuryStatus(
  userId: string,
  data: InjuryStatusUpdate
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('injury_status')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  return { error: error ? error.message : null };
}
