import { useState, useEffect } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

/**
 * Subscribes to Supabase auth state and exposes the current user, session,
 * and a loading flag for the initial session resolution.
 *
 * Use this hook at the root layout level. Do not call it in multiple places —
 * pass the result down via context if needed.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    // Resolve initial session (handles app resume with persisted token)
    supabase.auth.getSession().then(({ data }) => {
      setState({
        user: data.session?.user ?? null,
        session: data.session,
        loading: false,
      });
    });

    // Subscribe to auth events (sign in, sign out, token refresh)
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
      });
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}
