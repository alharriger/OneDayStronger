import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

/**
 * Reads the user's onboarding_step from their profile and redirects to the
 * correct screen if onboarding is incomplete.
 *
 * Called inside the main app layout ((app)/_layout.tsx) so any deep link or
 * direct navigation to a main tab is intercepted when onboarding is pending.
 */
export function useOnboardingGuard() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    async function checkOnboardingStep() {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_step')
        .eq('user_id', user!.id)
        .single();

      if (error) {
        console.error('[useOnboardingGuard] profile query error:', error.code, error.message);
        return;
      }
      if (!data) {
        console.warn('[useOnboardingGuard] no profile found for user:', user!.id);
        return;
      }
      console.log('[useOnboardingGuard] onboarding_step:', data.onboarding_step);

      switch (data.onboarding_step) {
        case 'intake':
          router.replace('/(onboarding)/welcome');
          break;
        case 'goal':
          router.replace('/(onboarding)/goal-selection');
          break;
        case 'generating':
          router.replace('/(onboarding)/plan-generation');
          break;
        case 'complete':
          // Onboarding done — stay in main app
          break;
      }
    }

    checkOnboardingStep();
  }, [user]);
}
