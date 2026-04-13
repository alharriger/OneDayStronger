/**
 * Smoke tests for the Today screen.
 *
 * Full interaction testing is deferred to useTodayWorkout hook tests due to
 * the React 19.2.5 / react-native-renderer 19.2.3 version mismatch that
 * causes TouchableOpacity animation checks to fail in test mode.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import TodayScreen from '../../app/(app)/today';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

const mockUseTodayWorkout = jest.fn();

jest.mock('@/hooks/useTodayWorkout', () => ({
  useTodayWorkout: (...args: unknown[]) => mockUseTodayWorkout(...args),
}));

const loadingState = {
  phase: 'loading',
  sessionId: null,
  checkInId: null,
  workout: null,
  safetyEventId: null,
  safetyDetails: null,
  error: null,
  isRetryable: false,
  submitCheckIn: jest.fn(),
  retryWorkoutGeneration: jest.fn(),
  acknowledgeSafety: jest.fn(),
};

jest.mock('@/services/safetyEvents', () => ({
  acknowledgeSafetyEvent: jest.fn(),
}));

jest.mock('@/services/evolution', () => ({
  getUnseenEvents: jest.fn().mockResolvedValue([]),
  markEventSeen: jest.fn(),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TodayScreen', () => {
  beforeEach(() => {
    mockUseTodayWorkout.mockReturnValue(loadingState);
  });

  it('renders without crashing', () => {
    expect(() => render(<TodayScreen />)).not.toThrow();
  });

  it('displays the screen title', () => {
    render(<TodayScreen />);
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('shows loading state while phase is loading', () => {
    render(<TodayScreen />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });
});

describe('TodayScreen — check_in phase', () => {
  beforeEach(() => {
    mockUseTodayWorkout.mockReturnValue({
      ...loadingState,
      phase: 'check_in',
      sessionId: 'session-1',
    });
  });

  it('displays the check-in prompt', () => {
    render(<TodayScreen />);
    expect(screen.getByText(/how are you feeling/i)).toBeTruthy();
  });

  it('displays a generate workout button', () => {
    render(<TodayScreen />);
    expect(screen.getByText('Generate my workout')).toBeTruthy();
  });
});

describe('TodayScreen — error phase', () => {
  beforeEach(() => {
    mockUseTodayWorkout.mockReturnValue({
      ...loadingState,
      phase: 'error',
      error: "Something went wrong loading today's data.",
      isRetryable: true,
    });
  });

  it('displays the error message', () => {
    render(<TodayScreen />);
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
  });

  it('displays a retry button', () => {
    render(<TodayScreen />);
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});
