/**
 * Tests for the Plan screen — phase preview, expand/collapse, and phase jump.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import PlanScreen from '../../app/(app)/plan';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

jest.mock('@/services/plans', () => ({
  getActivePlan: jest.fn(),
  jumpToPhase: jest.fn(),
}));

jest.mock('@/lib/planEvents', () => ({
  notifyPlanChanged: jest.fn(),
}));

// phosphor-react-native icons used in plan.tsx
jest.mock('phosphor-react-native', () => ({
  CaretDown: () => null,
  CaretUp: () => null,
}));

const { getActivePlan, jumpToPhase } = require('@/services/plans');

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const makePhase = (overrides: Record<string, unknown>) => ({
  id: 'phase-default',
  phase_number: 1,
  name: 'Isometrics',
  plain_language_summary: 'Start with gentle isometric holds.',
  description: 'Isometric loading phase.',
  status: 'active',
  estimated_duration_weeks: 4,
  progression_criteria: { pain_threshold: 3, consistency_pct: 80 },
  regression_criteria: {},
  phase_exercises: [],
  ...overrides,
});

const activePhasePlan = {
  id: 'plan-1',
  plain_language_summary: 'Your 16-week PHT rehab plan.',
  rehab_goal: 'return_to_running',
  status: 'active',
  plan_phases: [
    makePhase({ id: 'phase-1', phase_number: 1, status: 'active', name: 'Isometrics' }),
    makePhase({ id: 'phase-2', phase_number: 2, status: 'upcoming', name: 'Load Progression' }),
    makePhase({ id: 'phase-3', phase_number: 3, status: 'upcoming', name: 'Strength' }),
  ],
};

// ─── Basic render ─────────────────────────────────────────────────────────────

describe('PlanScreen — empty state', () => {
  beforeEach(() => getActivePlan.mockResolvedValue(null));

  it('renders without crashing', () => {
    expect(() => render(<PlanScreen />)).not.toThrow();
  });

  it('displays the screen title', () => {
    render(<PlanScreen />);
    expect(screen.getByText('Your Plan')).toBeTruthy();
  });
});

// ─── Phase display ────────────────────────────────────────────────────────────

describe('PlanScreen — phase display', () => {
  beforeEach(() => getActivePlan.mockResolvedValue(activePhasePlan));

  it('shows the plan overview summary', async () => {
    render(<PlanScreen />);
    await screen.findByText(/16-week/i);
    expect(screen.getByText(/16-week/i)).toBeTruthy();
  });

  it('expands the active phase by default', async () => {
    render(<PlanScreen />);
    await screen.findByText(/gentle isometric holds/i);
    expect(screen.getByText(/gentle isometric holds/i)).toBeTruthy();
  });

  it('does not show upcoming phase body text before expanding', async () => {
    getActivePlan.mockResolvedValue({
      ...activePhasePlan,
      plan_phases: [
        makePhase({
          id: 'phase-1',
          phase_number: 1,
          status: 'upcoming',
          name: 'Isometrics',
          plain_language_summary: 'Start with gentle isometric holds.',
        }),
      ],
    });
    render(<PlanScreen />);
    await screen.findByText('Your Plan');
    // The summary text should not be visible until the user taps to expand
    expect(screen.queryByText(/gentle isometric holds/i)).toBeNull();
  });

  it('shows phase body text after tapping collapsed phase header', async () => {
    render(<PlanScreen />);
    await screen.findByText(/16-week/i);

    const upcomingHeader = screen.getByLabelText(/Expand phase 2/i);
    fireEvent.press(upcomingHeader);
    await waitFor(() =>
      expect(screen.queryByText(/Load Progression/i)).toBeTruthy()
    );
  });

  it('shows "Current phase" label on the active phase header', async () => {
    render(<PlanScreen />);
    await screen.findByText('Current phase');
    expect(screen.getByText('Current phase')).toBeTruthy();
  });

  it('shows "Upcoming" label on upcoming phase headers', async () => {
    render(<PlanScreen />);
    await screen.findByText(/16-week/i);
    const upcomingLabels = screen.getAllByText('Upcoming');
    expect(upcomingLabels.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── "I'm already here" interaction ──────────────────────────────────────────

describe('PlanScreen — I\'m already here', () => {
  beforeEach(() => {
    getActivePlan.mockResolvedValue(activePhasePlan);
    jumpToPhase.mockResolvedValue({ error: null });
  });

  it('does NOT show "I\'m already here" on the active phase', async () => {
    render(<PlanScreen />);
    await screen.findByText('Current phase');
    // Active phase is expanded by default — button must NOT appear there
    expect(screen.queryByText("I'm already here")).toBeNull();
  });

  it('shows "I\'m already here" on an expanded upcoming phase', async () => {
    render(<PlanScreen />);
    await screen.findByText(/16-week/i);

    // Expand phase 2
    const expandBtn = screen.getByLabelText(/Expand phase 2/i);
    fireEvent.press(expandBtn);

    await waitFor(() =>
      expect(screen.getAllByText("I'm already here").length).toBeGreaterThanOrEqual(1)
    );
  });

  it('opens the confirmation modal when "I\'m already here" is pressed on upcoming phase', async () => {
    render(<PlanScreen />);
    await screen.findByText(/16-week/i);

    // Only the upcoming phase's button appears (active phase has no button)
    fireEvent.press(screen.getByLabelText(/Expand phase 2/i));
    await waitFor(() =>
      expect(screen.getAllByText("I'm already here").length).toBeGreaterThanOrEqual(1)
    );

    // Press the first (and only) "I'm already here" — phase 2
    fireEvent.press(screen.getAllByText("I'm already here")[0]);

    await waitFor(() =>
      expect(screen.getByText(/Start at Phase 2/i)).toBeTruthy()
    );
  });

  it('dismisses the modal when Cancel is pressed', async () => {
    render(<PlanScreen />);
    await screen.findByText(/16-week/i);

    fireEvent.press(screen.getByLabelText(/Expand phase 2/i));
    await waitFor(() => expect(screen.getAllByText("I'm already here").length).toBeGreaterThanOrEqual(1));
    fireEvent.press(screen.getAllByText("I'm already here")[0]);
    await waitFor(() => screen.getByText(/Start at Phase 2/i));

    fireEvent.press(screen.getByText('Cancel'));

    await waitFor(() =>
      expect(screen.queryByText(/Start at Phase 2/i)).toBeNull()
    );
    expect(jumpToPhase).not.toHaveBeenCalled();
  });

  it('calls jumpToPhase with correct args when confirmed', async () => {
    render(<PlanScreen />);
    await screen.findByText(/16-week/i);

    fireEvent.press(screen.getByLabelText(/Expand phase 2/i));
    await waitFor(() => expect(screen.getAllByText("I'm already here").length).toBeGreaterThanOrEqual(1));
    fireEvent.press(screen.getAllByText("I'm already here")[0]);
    await waitFor(() => screen.getByText('Yes, start here'));

    fireEvent.press(screen.getByText('Yes, start here'));

    await waitFor(() =>
      expect(jumpToPhase).toHaveBeenCalledWith({
        planId: 'plan-1',
        userId: 'test-user-id',
        targetPhaseId: 'phase-2',
        targetPhaseNumber: 2,
        fromPhaseId: 'phase-1',
        fromPhaseNumber: 1,
      })
    );
  });

  it('reloads the plan after a successful jump', async () => {
    render(<PlanScreen />);
    await screen.findByText(/16-week/i);

    fireEvent.press(screen.getByLabelText(/Expand phase 2/i));
    await waitFor(() => expect(screen.getAllByText("I'm already here").length).toBeGreaterThanOrEqual(1));
    fireEvent.press(screen.getAllByText("I'm already here")[0]);
    await waitFor(() => screen.getByText('Yes, start here'));
    fireEvent.press(screen.getByText('Yes, start here'));

    await waitFor(() =>
      // getActivePlan called at least twice: initial load + reload after jump
      expect(getActivePlan.mock.calls.length).toBeGreaterThanOrEqual(2)
    );
  });

  it('shows an Alert and closes the modal if jumpToPhase returns an error', async () => {
    jumpToPhase.mockResolvedValueOnce({ error: 'Something went wrong' });
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');

    render(<PlanScreen />);
    await screen.findByText(/16-week/i);

    fireEvent.press(screen.getByLabelText(/Expand phase 2/i));
    await waitFor(() => expect(screen.getAllByText("I'm already here").length).toBeGreaterThanOrEqual(1));
    fireEvent.press(screen.getAllByText("I'm already here")[0]);
    await waitFor(() => screen.getByText('Yes, start here'));

    await act(async () => {
      fireEvent.press(screen.getByText('Yes, start here'));
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(screen.queryByText(/Start at Phase 2/i)).toBeNull();
  });

  it('shows "Go back to this phase" on a completed phase', async () => {
    getActivePlan.mockResolvedValue({
      ...activePhasePlan,
      plan_phases: [
        makePhase({ id: 'phase-1', phase_number: 1, status: 'completed', name: 'Isometrics' }),
        makePhase({ id: 'phase-2', phase_number: 2, status: 'active', name: 'Load Progression' }),
      ],
    });
    render(<PlanScreen />);
    await screen.findByText('Current phase');

    // Expand phase 1 (completed)
    fireEvent.press(screen.getByLabelText(/Expand phase 1/i));
    await waitFor(() =>
      expect(screen.getByText('Go back to this phase')).toBeTruthy()
    );
  });
});
