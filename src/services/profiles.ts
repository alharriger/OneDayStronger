import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
type OnboardingStep = Profile['onboarding_step'];

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) return null;
  return data;
}

export async function updateOnboardingStep(
  userId: string,
  step: OnboardingStep
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_step: step, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  return { error: error ? error.message : null };
}

export async function updateProfile(
  userId: string,
  data: ProfileUpdate
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  return { error: error ? error.message : null };
}
