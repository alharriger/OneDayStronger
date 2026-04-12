import { supabase } from './supabase';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

// ─── Sign Up ──────────────────────────────────────────────────────────────────

export interface SignUpResult {
  user: User | null;
  error: string | null;
}

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { user: null, error: error.message };
  }

  return { user: data.user, error: null };
}

// ─── Sign In ──────────────────────────────────────────────────────────────────

export interface SignInResult {
  user: User | null;
  error: string | null;
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { user: null, error: error.message };
  }

  return { user: data.user, error: null };
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

export async function signOut(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut();
  return { error: error ? error.message : null };
}

// ─── Get Session ──────────────────────────────────────────────────────────────

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ─── Auth State Change ────────────────────────────────────────────────────────

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return data.subscription;
}
