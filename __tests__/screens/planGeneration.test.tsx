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

// Prevent the rotating spinner animation from creating RAF loops that
// interfere with jest.useFakeTimers() in the error-state tests.
jest.mock('@/components/ui/SpinnerRing', () => ({
  SpinnerRing: () => null,
}));

// Import AFTER the mock registration so we get the mocked version.
import { supabase } from '@/lib/supabase';
const mockInvoke = supabase.functions.invoke as jest.Mock;

// ─── Tests ────────────────────────────────────────────────────────────────────

/**
 * Helper: renders the component with fake timers already active, advances
 * past the 10-second auto-retry delay, and waits for the second (failing)
 * invoke to settle — leaving the component in error state.
 *
 * The component retries once automatically after a 10s wait before surfacing
 * the error state to the user. Tests that assert error UI must skip that delay.
 */
async function renderAndReachErrorState() {
  render(<PlanGenerationScreen />);
  // Skip the 10s auto-retry setTimeout; advanceTimersByTimeAsync also flushes
  // pending microtasks so the async generatePlan chain resolves fully.
  await jest.advanceTimersByTimeAsync(11000);
}

describe('PlanGenerationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReplace.mockReset();
  });

  afterEach(() => {
    // Restore real timers after any test that enabled fake timers.
    jest.useRealTimers();
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

  // ── Error-state tests use fake timers to skip the 10s auto-retry delay ───────

  it('shows error state when the edge function returns an HTTP error', async () => {
    jest.useFakeTimers();
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge function returned a non-2xx status code' },
    });
    await renderAndReachErrorState();
    expect(screen.getByText("Let's try that again")).toBeTruthy();
  });

  it('shows error state when planId is missing from the response', async () => {
    jest.useFakeTimers();
    mockInvoke.mockResolvedValue({ data: {}, error: null });
    await renderAndReachErrorState();
    expect(screen.getByText("Let's try that again")).toBeTruthy();
  });

  it('shows the error message from data.error when present', async () => {
    jest.useFakeTimers();
    mockInvoke.mockResolvedValue({
      data: { error: 'Intake data not found. Please complete the intake form first.' },
      error: null,
    });
    await renderAndReachErrorState();
    expect(screen.getByText('Intake data not found. Please complete the intake form first.')).toBeTruthy();
  });

  it('shows fallback error message when no error detail is available', async () => {
    jest.useFakeTimers();
    // data is null → data?.error is undefined → throws 'Plan generation failed.'
    mockInvoke.mockResolvedValue({ data: null, error: null });
    await renderAndReachErrorState();
    expect(screen.getByText('Plan generation failed.')).toBeTruthy();
  });

  it('shows a retry button in the error state', async () => {
    jest.useFakeTimers();
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Timeout' } });
    await renderAndReachErrorState();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('re-invokes the edge function when the retry button is pressed', async () => {
    jest.useFakeTimers();
    // Initial mock: fail on both auto-retry attempts (calls 1 and 2)
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Timeout' } });

    await renderAndReachErrorState();
    expect(screen.getByText('Try again')).toBeTruthy();

    // Switch to success before pressing retry (call 3 succeeds immediately)
    mockInvoke.mockResolvedValue({ data: { planId: 'plan-retry' }, error: null });

    await act(async () => {
      fireEvent.press(screen.getByText('Try again'));
    });

    // 3 total: initial attempt + auto-retry + manual retry
    expect(mockInvoke).toHaveBeenCalledTimes(3);
  });
});
