/**
 * Smoke tests for the Profile screen.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ProfileScreen from '../../app/(app)/profile';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

jest.mock('@/services/profiles', () => ({
  getProfile: jest.fn().mockResolvedValue({
    user_id: 'test-user-id',
    age: 34,
    gender: 'female',
    rehab_goal: 'return_to_running',
    onboarding_step: 'complete',
    notification_time: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  }),
}));

jest.mock('@/services/intake', () => ({
  getInjuryIntake: jest.fn().mockResolvedValue({
    id: 'intake-1',
    user_id: 'test-user-id',
    injury_onset_date: '2025-06-01',
    mechanism: 'gradual',
    prior_treatment: 'Physical therapy',
    irritability_level: 'moderate',
    training_background: 'Regular runner, 30 miles/week',
    created_at: '2026-01-01',
  }),
  getInjuryStatus: jest.fn().mockResolvedValue({
    id: 'status-1',
    user_id: 'test-user-id',
    pain_level_baseline: 3,
    current_symptoms: 'Mild ache at sit bone',
    last_flare_date: null,
    updated_at: '2026-04-01',
  }),
  updateInjuryStatus: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('@/lib/auth', () => ({
  signOut: jest.fn(),
  deleteAccount: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('@/services/revision', () => ({
  invokeRevisePlan: jest.fn().mockResolvedValue({ planId: null, summary: null, error: null }),
}));

describe('ProfileScreen', () => {
  it('renders without crashing', () => {
    expect(() => render(<ProfileScreen />)).not.toThrow();
  });

  it('displays the screen title', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('Profile')).toBeTruthy();
  });
});

describe('ProfileScreen — with data loaded', () => {
  it('shows the injury status section heading after data loads', async () => {
    render(<ProfileScreen />);
    await screen.findByText('Current injury status');
    expect(screen.getByText('Current injury status')).toBeTruthy();
  });

  it('shows the sign out button', async () => {
    render(<ProfileScreen />);
    await screen.findByText('Sign out');
    expect(screen.getByText('Sign out')).toBeTruthy();
  });

  it('shows the delete account button', async () => {
    render(<ProfileScreen />);
    await screen.findByText('Delete account');
    expect(screen.getByText('Delete account')).toBeTruthy();
  });

  it('shows the educational disclaimer', async () => {
    render(<ProfileScreen />);
    await screen.findByText(/educational tool/i);
    expect(screen.getByText(/educational tool/i)).toBeTruthy();
  });

  it('shows intake information section when intake data is present', async () => {
    render(<ProfileScreen />);
    await screen.findByText('Intake information');
    expect(screen.getByText('Intake information')).toBeTruthy();
  });

  it('shows rehab goal section when goal is set', async () => {
    render(<ProfileScreen />);
    await screen.findByText('Rehab goal');
    expect(screen.getByText('Return to running')).toBeTruthy();
  });
});
