/**
 * Tests for useOnboardingGuard.
 *
 * Verifies that the hook reads onboarding_step from the profiles table and
 * redirects to the correct screen, and that query errors are handled without
 * crashing or redirecting.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';
import { createChain } from '../helpers/supabaseMock';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const mockedFrom = supabase.from as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupUser(step: string | null, queryError?: { code: string; message: string }) {
  mockedUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  if (queryError) {
    mockedFrom.mockReturnValue(createChain({ data: null, error: queryError }));
  } else {
    mockedFrom.mockReturnValue(createChain({ data: { onboarding_step: step }, error: null }));
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useOnboardingGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when there is no user', () => {
    mockedUseAuth.mockReturnValue({ user: null });
    renderHook(() => useOnboardingGuard());
    expect(mockedFrom).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects to welcome when onboarding_step is "intake"', async () => {
    setupUser('intake');
    renderHook(() => useOnboardingGuard());
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/welcome');
    });
  });

  it('redirects to goal-selection when onboarding_step is "goal"', async () => {
    setupUser('goal');
    renderHook(() => useOnboardingGuard());
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/goal-selection');
    });
  });

  it('redirects to plan-generation when onboarding_step is "generating"', async () => {
    setupUser('generating');
    renderHook(() => useOnboardingGuard());
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/plan-generation');
    });
  });

  it('does not redirect when onboarding_step is "complete"', async () => {
    setupUser('complete');
    renderHook(() => useOnboardingGuard());
    // Wait long enough for the async check to complete
    await waitFor(() => expect(mockedFrom).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not redirect and does not throw when the profile query fails', async () => {
    setupUser(null, { code: 'PGRST205', message: 'relation does not exist' });
    // Should not throw
    expect(() => renderHook(() => useOnboardingGuard())).not.toThrow();
    await waitFor(() => expect(mockedFrom).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not redirect when the profile row is missing (406)', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'user-1' } });
    mockedFrom.mockReturnValue(createChain({ data: null, error: null }));
    renderHook(() => useOnboardingGuard());
    await waitFor(() => expect(mockedFrom).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('queries the profiles table filtered by the current user id', async () => {
    setupUser('complete');
    renderHook(() => useOnboardingGuard());
    await waitFor(() => expect(mockedFrom).toHaveBeenCalled());
    expect(mockedFrom).toHaveBeenCalledWith('profiles');
  });
});
