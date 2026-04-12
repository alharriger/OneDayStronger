/**
 * Smoke tests for the Goal Selection screen.
 *
 * Note: fireEvent.press interactions are not tested here due to a known
 * React 19.2.5 / react-native-renderer 19.2.3 version mismatch that causes
 * TouchableOpacity animation checks to throw in test mode. Navigation and
 * submission logic is covered by the useIntakeForm hook tests instead.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import GoalSelectionScreen from '../../app/(onboarding)/goal-selection';

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

jest.mock('@/services/profiles', () => ({
  updateProfile: jest.fn().mockResolvedValue({ error: null }),
  updateOnboardingStep: jest.fn().mockResolvedValue({ error: null }),
  getProfile: jest.fn(),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GoalSelectionScreen', () => {
  it('renders without crashing', () => {
    expect(() => render(<GoalSelectionScreen />)).not.toThrow();
  });

  it('displays the screen title', () => {
    render(<GoalSelectionScreen />);
    expect(screen.getByText("What's your goal?")).toBeTruthy();
  });

  it('renders all four goal options', () => {
    render(<GoalSelectionScreen />);
    expect(screen.getByText('Pain-free daily life')).toBeTruthy();
    expect(screen.getByText('Return to running')).toBeTruthy();
    expect(screen.getByText('Return to sport')).toBeTruthy();
    expect(screen.getByText('Something else')).toBeTruthy();
  });

  it('displays the "Build my plan" button', () => {
    render(<GoalSelectionScreen />);
    expect(screen.getByText('Build my plan')).toBeTruthy();
  });
});
