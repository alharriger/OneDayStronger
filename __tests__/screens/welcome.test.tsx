/**
 * Smoke tests for the Welcome screen.
 *
 * Note: fireEvent.press interactions are not tested here due to a known
 * React 19.2.5 / react-native-renderer 19.2.3 version mismatch that causes
 * TouchableOpacity animation checks to throw in test mode. Navigation logic
 * is covered by the useIntakeForm hook tests instead.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import WelcomeScreen from '../../app/(onboarding)/welcome';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('WelcomeScreen', () => {
  it('renders without crashing', () => {
    expect(() => render(<WelcomeScreen />)).not.toThrow();
  });

  it('displays the app name', () => {
    render(<WelcomeScreen />);
    expect(screen.getByText('One Day Stronger')).toBeTruthy();
  });

  it('displays a "Get started" button', () => {
    render(<WelcomeScreen />);
    expect(screen.getByText('Get started')).toBeTruthy();
  });

  it('displays the educational disclaimer', () => {
    render(<WelcomeScreen />);
    expect(screen.getByText(/educational tool/i)).toBeTruthy();
  });

  it('displays the subtitle describing the app', () => {
    render(<WelcomeScreen />);
    expect(screen.getByText(/proximal hamstring tendinopathy/i)).toBeTruthy();
  });
});
