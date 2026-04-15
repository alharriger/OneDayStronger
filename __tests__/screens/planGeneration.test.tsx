/**
 * Tests for the Plan Generation screen.
 *
 * Covers:
 * - Loading state renders while the edge function is in-flight
 * - Success: navigates to plan-summary when planId is returned
 * - Edge function HTTP error: shows error state
 * - Missing planId in response: shows error state with fallback message
 * - Explicit error field in response: shows that error message
 * - Retry button re-invokes the edge function
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import PlanGenerationScreen from '../../app/(onboarding)/plan-generation';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Use a stable user reference so the useEffect dep doesn't re-fire on every render.
jest.mock('@/hooks/useAuth', () => {
  const stableUser = { id: 'test-user-id' };
  return { useAuth: () => ({ user: stableUser }) };
});

jest.mock('@/services/profiles', () => ({
  updateOnboardingStep: jest.fn().mockResolvedValue({ error: null }),
}));

// Declare the mock INSIDE the factory so hoisting picks it up correctly.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
  },
}));

// Import AFTER the mock registration so we get the mocked version.
import { supabase } from '@/lib/supabase';
const mockInvoke = supabase.functions.invoke as jest.Mock;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlanGenerationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReplace.mockReset();
  });

  it('shows the "Building your plan" heading while generating', () => {
    mockInvoke.mockReturnValue(new Promise(() => {})); // never resolves
    render(<PlanGenerationScreen />);
    expect(screen.getByText('Building your plan')).toBeTruthy();
  });

  it('navigates to plan-summary after successful plan generation', async () => {
    mockInvoke.mockResolvedValue({
      data: { planId: 'plan-abc', summary: 'Your 3-phase plan.' },
      error: null,
    });
    render(<PlanGenerationScreen />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/plan-summary');
    }, { timeout: 3000 });
  });

  it('calls the generate-plan edge function', async () => {
    mockInvoke.mockResolvedValue({ data: { planId: 'plan-1' }, error: null });
    render(<PlanGenerationScreen />);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
    expect(mockInvoke).toHaveBeenCalledWith('generate-plan', expect.any(Object));
  });

  it('shows error state when the edge function returns an HTTP error', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge function returned a non-2xx status code' },
    });
    render(<PlanGenerationScreen />);
    await waitFor(() => {
      expect(screen.getByText("Let's try that again")).toBeTruthy();
    });
  });

  it('shows error state when planId is missing from the response', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null });
    render(<PlanGenerationScreen />);
    await waitFor(() => {
      expect(screen.getByText("Let's try that again")).toBeTruthy();
    });
  });

  it('shows the error message from data.error when present', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'Intake data not found. Please complete the intake form first.' },
      error: null,
    });
    render(<PlanGenerationScreen />);
    await waitFor(() => {
      expect(screen.getByText('Intake data not found. Please complete the intake form first.')).toBeTruthy();
    });
  });

  it('shows fallback error message when no error detail is available', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    render(<PlanGenerationScreen />);
    await waitFor(() => {
      // data is null so data?.error is undefined → throws 'Plan generation failed.'
      expect(screen.getByText('Plan generation failed.')).toBeTruthy();
    });
  });

  it('shows a retry button in the error state', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Timeout' } });
    render(<PlanGenerationScreen />);
    await waitFor(() => {
      expect(screen.getByText('Try again')).toBeTruthy();
    });
  });

  it('re-invokes the edge function when the retry button is pressed', async () => {
    // Render with a failing invoke so the error/retry state appears.
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Timeout' } });

    render(<PlanGenerationScreen />);
    await waitFor(() => expect(screen.getByText('Try again')).toBeTruthy(), { timeout: 3000 });

    // Change mock BEFORE pressing retry so the second call succeeds.
    mockInvoke.mockResolvedValue({ data: { planId: 'plan-retry' }, error: null });

    // Press synchronously — component sets status back to 'generating' immediately,
    // so we must get the element BEFORE the re-render, i.e. outside any act block.
    fireEvent.press(screen.getByText('Try again'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    }, { timeout: 3000 });
  });
});
