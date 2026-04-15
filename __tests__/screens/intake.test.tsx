/**
 * Tests for the Intake screen.
 *
 * Covers:
 * - Renders each step correctly
 * - Back button on step 1 calls router.back()
 * - Submit errors are displayed (regression: previously silently dropped)
 * - Navigation to goal-selection on successful submit
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import IntakeScreen from '../../app/(onboarding)/intake';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

const mockSubmitIntake = jest.fn();
const mockGoToNextStep = jest.fn();
const mockGoToPrevStep = jest.fn();
const mockUpdateStep1 = jest.fn();

jest.mock('@/hooks/useIntakeForm', () => ({
  INTAKE_TOTAL_STEPS: 4,
  useIntakeForm: jest.fn(),
}));

import { useIntakeForm } from '@/hooks/useIntakeForm';
const mockUseIntakeForm = useIntakeForm as jest.Mock;

function buildFormState(overrides: Partial<ReturnType<typeof useIntakeForm>> = {}): ReturnType<typeof useIntakeForm> {
  return {
    currentStep: 1,
    formData: {
      step1: { age: '', gender: null },
      step2: { injury_onset_date: '', mechanism: null },
      step3: { prior_treatment: '', training_background: '' },
      step4: { irritability_level: null, pain_level_baseline: 0, current_symptoms: '' },
    },
    validationError: null,
    isSubmitting: false,
    updateStep1: mockUpdateStep1,
    updateStep2: jest.fn(),
    updateStep3: jest.fn(),
    updateStep4: jest.fn(),
    goToNextStep: mockGoToNextStep,
    goToPrevStep: mockGoToPrevStep,
    submitIntake: mockSubmitIntake,
    ...overrides,
  } as unknown as ReturnType<typeof useIntakeForm>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IntakeScreen — rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIntakeForm.mockReturnValue(buildFormState());
  });

  it('renders without crashing', () => {
    expect(() => render(<IntakeScreen />)).not.toThrow();
  });

  it('shows step 1 title on step 1', () => {
    render(<IntakeScreen />);
    expect(screen.getByText("Let's start with the basics")).toBeTruthy();
  });

  it('shows step 2 title on step 2', () => {
    mockUseIntakeForm.mockReturnValue(buildFormState({ currentStep: 2 }));
    render(<IntakeScreen />);
    expect(screen.getByText('About your injury')).toBeTruthy();
  });

  it('shows step 3 title on step 3', () => {
    mockUseIntakeForm.mockReturnValue(buildFormState({ currentStep: 3 }));
    render(<IntakeScreen />);
    expect(screen.getByText('Treatment & training')).toBeTruthy();
  });

  it('shows step 4 title on step 4', () => {
    mockUseIntakeForm.mockReturnValue(buildFormState({ currentStep: 4 }));
    render(<IntakeScreen />);
    expect(screen.getByText('How are you feeling now?')).toBeTruthy();
  });

  it('shows "Continue to goals" on the last step', () => {
    mockUseIntakeForm.mockReturnValue(buildFormState({ currentStep: 4 }));
    render(<IntakeScreen />);
    expect(screen.getByText('Continue to goals')).toBeTruthy();
  });

  it('shows "Next" button on non-final steps', () => {
    render(<IntakeScreen />);
    expect(screen.getByText('Next')).toBeTruthy();
  });
});

describe('IntakeScreen — navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls router.back() when Back is pressed on step 1', async () => {
    mockUseIntakeForm.mockReturnValue(buildFormState({ currentStep: 1 }));
    render(<IntakeScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Back'));
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('calls goToPrevStep when Back is pressed on step 2+', async () => {
    mockUseIntakeForm.mockReturnValue(buildFormState({ currentStep: 2 }));
    render(<IntakeScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Back'));
    });
    expect(mockGoToPrevStep).toHaveBeenCalledTimes(1);
  });

  it('calls goToNextStep when Next is pressed on non-final step', async () => {
    mockUseIntakeForm.mockReturnValue(buildFormState({ currentStep: 1 }));
    render(<IntakeScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Next'));
    });
    expect(mockGoToNextStep).toHaveBeenCalledTimes(1);
  });
});

describe('IntakeScreen — submit error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows an Alert when submitIntake returns an error', async () => {
    mockSubmitIntake.mockResolvedValue({ error: 'Network request failed' });
    mockUseIntakeForm.mockReturnValue(buildFormState({ currentStep: 4 }));
    const alertSpy = jest.spyOn(Alert, 'alert');

    render(<IntakeScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Continue to goals'));
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Could not save', 'Network request failed');
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('navigates to goal-selection when submitIntake succeeds', async () => {
    mockSubmitIntake.mockResolvedValue({ error: null });
    mockUseIntakeForm.mockReturnValue(buildFormState({ currentStep: 4 }));

    render(<IntakeScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Continue to goals'));
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/goal-selection');
    });
  });
});
