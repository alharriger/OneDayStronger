/**
 * Unit tests for src/lib/auth.ts
 *
 * Covers: signUp, signIn, signOut, deleteAccount
 *
 * All Supabase client calls are mocked at the module level.
 */

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
}));

import { supabase } from '@/lib/supabase';
import { signUp, signIn, signOut, deleteAccount } from '@/lib/auth';

const mockSignUp = supabase.auth.signUp as jest.Mock;
const mockSignIn = supabase.auth.signInWithPassword as jest.Mock;
const mockSignOut = supabase.auth.signOut as jest.Mock;
const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFunctionsInvoke = supabase.functions.invoke as jest.Mock;

const fakeUser = { id: 'user-1', email: 'test@example.com' };
const fakeSession = { access_token: 'tok', user: fakeUser };

// ─── signUp ───────────────────────────────────────────────────────────────────

describe('signUp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the user on success', async () => {
    mockSignUp.mockResolvedValue({ data: { user: fakeUser }, error: null });
    const result = await signUp('test@example.com', 'password123');
    expect(result.user).toEqual(fakeUser);
    expect(result.error).toBeNull();
  });

  it('returns null user and error message on failure', async () => {
    mockSignUp.mockResolvedValue({ data: { user: null }, error: { message: 'Email already registered' } });
    const result = await signUp('taken@example.com', 'password123');
    expect(result.user).toBeNull();
    expect(result.error).toBe('Email already registered');
  });

  it('calls supabase.auth.signUp with the provided credentials', async () => {
    mockSignUp.mockResolvedValue({ data: { user: fakeUser }, error: null });
    await signUp('test@example.com', 'mypassword');
    expect(mockSignUp).toHaveBeenCalledWith({ email: 'test@example.com', password: 'mypassword' });
  });
});

// ─── signIn ───────────────────────────────────────────────────────────────────

describe('signIn', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the user on success', async () => {
    mockSignIn.mockResolvedValue({ data: { user: fakeUser }, error: null });
    const result = await signIn('test@example.com', 'password123');
    expect(result.user).toEqual(fakeUser);
    expect(result.error).toBeNull();
  });

  it('returns null user and error message on wrong credentials', async () => {
    mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } });
    const result = await signIn('test@example.com', 'wrongpassword');
    expect(result.user).toBeNull();
    expect(result.error).toBe('Invalid login credentials');
  });

  it('calls supabase.auth.signInWithPassword', async () => {
    mockSignIn.mockResolvedValue({ data: { user: fakeUser }, error: null });
    await signIn('test@example.com', 'password123');
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password123' });
  });
});

// ─── signOut ──────────────────────────────────────────────────────────────────

describe('signOut', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null error on success', async () => {
    mockSignOut.mockResolvedValue({ error: null });
    const { error } = await signOut();
    expect(error).toBeNull();
  });

  it('returns error message on failure', async () => {
    mockSignOut.mockResolvedValue({ error: { message: 'Session expired' } });
    const { error } = await signOut();
    expect(error).toBe('Session expired');
  });
});

// ─── deleteAccount ────────────────────────────────────────────────────────────

describe('deleteAccount', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns error "Not authenticated" when there is no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { error } = await deleteAccount();
    expect(error).toBe('Not authenticated');
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it('calls delete-account edge function when session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } });
    mockFunctionsInvoke.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
    await deleteAccount();
    expect(mockFunctionsInvoke).toHaveBeenCalledWith('delete-account');
  });

  it('returns error message when the edge function fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } });
    mockFunctionsInvoke.mockResolvedValue({ error: { message: 'Server error' } });
    const { error } = await deleteAccount();
    expect(error).toBe('Server error');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('calls signOut and returns null error on success', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } });
    mockFunctionsInvoke.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
    const { error } = await deleteAccount();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(error).toBeNull();
  });
});
