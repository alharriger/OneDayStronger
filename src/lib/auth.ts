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

// ─── Delete Account ───────────────────────────────────────────────────────────

/**
 * Permanently deletes the current user's account and all associated data.
 *
 * Flow:
 * 1. Reads the active session — returns early if unauthenticated.
 * 2. Calls the `delete-account` edge function (uses service role to delete
 *    the auth user; all related rows cascade-delete via FK constraints).
 * 3. Signs out locally so the auth state clears and the root layout
 *    redirects to the login screen.
 */
export async function deleteAccount(): Promise<{ error: string | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: 'Not authenticated' };

  const { error } = await supabase.functions.invoke('delete-account');
  if (error) return { error: error.message };

  // Sign out locally after the server-side delete
  await supabase.auth.signOut();
  return { error: null };
}

// ─── Auth State Change ────────────────────────────────────────────────────────

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return data.subscription;
}
