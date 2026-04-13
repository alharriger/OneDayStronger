/**
 * Smoke tests for the Plan screen.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import PlanScreen from '../../app/(app)/plan';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

jest.mock('@/services/plans', () => ({
  getActivePlan: jest.fn().mockResolvedValue(null),
}));

describe('PlanScreen', () => {
  it('renders without crashing', () => {
    expect(() => render(<PlanScreen />)).not.toThrow();
  });

  it('displays the screen title', () => {
    render(<PlanScreen />);
    expect(screen.getByText('Your Plan')).toBeTruthy();
  });
});

describe('PlanScreen — with plan data', () => {
  beforeEach(() => {
    const { getActivePlan } = require('@/services/plans');
    getActivePlan.mockResolvedValue({
      id: 'plan-1',
      plain_language_summary: 'Your 16-week PHT rehab plan.',
      rehab_goal: 'return_to_running',
      status: 'active',
      plan_phases: [
        {
          id: 'phase-1',
          phase_number: 1,
          name: 'Isometrics',
          plain_language_summary: 'Start with gentle isometric holds.',
          description: 'Isometric loading phase.',
          status: 'active',
          estimated_duration_weeks: 4,
          progression_criteria: { pain_threshold: 3, consistency_pct: 80 },
          regression_criteria: {},
          phase_exercises: [],
        },
      ],
    });
  });

  it('displays the plan summary', async () => {
    render(<PlanScreen />);
    await screen.findByText(/16-week/i);
    expect(screen.getByText(/16-week/i)).toBeTruthy();
  });

  it('displays phase information', async () => {
    render(<PlanScreen />);
    await screen.findByText(/16-week/i);
    // Phase plan_language_summary should be visible
    expect(screen.getByText(/gentle isometric holds/i)).toBeTruthy();
  });
});
