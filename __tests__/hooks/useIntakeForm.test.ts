import { renderHook, act } from '@testing-library/react-native';
import { useIntakeForm } from '@/hooks/useIntakeForm';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

jest.mock('@/services/intake', () => ({
  saveInjuryIntake: jest.fn(),
  saveInjuryStatus: jest.fn(),
}));

jest.mock('@/services/profiles', () => ({
  updateOnboardingStep: jest.fn(),
  updateProfile: jest.fn(),
  getProfile: jest.fn(),
}));

import { saveInjuryIntake, saveInjuryStatus } from '@/services/intake';
import { updateOnboardingStep } from '@/services/profiles';

const mockSaveIntake = saveInjuryIntake as jest.Mock;
const mockSaveStatus = saveInjuryStatus as jest.Mock;
const mockUpdateStep = updateOnboardingStep as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function advanceToStep2(result: ReturnType<typeof renderHook<ReturnType<typeof useIntakeForm>, unknown>>['result']) {
  act(() => result.current.updateStep1({ age: '34', gender: 'female' }));
  act(() => result.current.goToNextStep());
}

function advanceToStep3(result: ReturnType<typeof renderHook<ReturnType<typeof useIntakeForm>, unknown>>['result']) {
  advanceToStep2(result);
  act(() => result.current.updateStep2({ injury_onset_date: '2024-01-01', mechanism: 'gradual' }));
  act(() => result.current.goToNextStep());
}

function advanceToStep4(result: ReturnType<typeof renderHook<ReturnType<typeof useIntakeForm>, unknown>>['result']) {
  advanceToStep3(result);
  act(() => result.current.updateStep3({ training_background: '3x/week runner' }));
  act(() => result.current.goToNextStep());
}

async function fillAllStepsAndSubmit(
  result: ReturnType<typeof renderHook<ReturnType<typeof useIntakeForm>, unknown>>['result']
) {
  advanceToStep4(result);
  act(() => result.current.updateStep4({
    irritability_level: 'low',
    pain_level_baseline: 2,
    current_symptoms: 'aching when sitting',
  }));
  let submitResult: { error: string | null } = { error: null };
  await act(async () => {
    submitResult = await result.current.submitIntake();
  });
  return submitResult;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useIntakeForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveIntake.mockResolvedValue({ id: 'intake-1', error: null });
    mockSaveStatus.mockResolvedValue({ id: 'status-1', error: null });
    mockUpdateStep.mockResolvedValue({ error: null });
  });

  // ─── Initial state ─────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts on step 1', () => {
      const { result } = renderHook(() => useIntakeForm());
      expect(result.current.currentStep).toBe(1);
    });

    it('has no validation error', () => {
      const { result } = renderHook(() => useIntakeForm());
      expect(result.current.validationError).toBeNull();
    });

    it('is not submitting', () => {
      const { result } = renderHook(() => useIntakeForm());
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  // ─── Step 1: Basic info ────────────────────────────────────────────────────

  describe('step 1 validation (basic info)', () => {
    it('rejects when age is empty', () => {
      const { result } = renderHook(() => useIntakeForm());
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toMatch(/age/i);
      expect(result.current.currentStep).toBe(1);
    });

    it('rejects non-numeric age', () => {
      const { result } = renderHook(() => useIntakeForm());
      act(() => result.current.updateStep1({ age: 'thirty', gender: 'female' }));
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toMatch(/age/i);
    });

    it('rejects age below 16', () => {
      const { result } = renderHook(() => useIntakeForm());
      act(() => result.current.updateStep1({ age: '10', gender: 'female' }));
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toMatch(/age/i);
    });

    it('rejects age above 100', () => {
      const { result } = renderHook(() => useIntakeForm());
      act(() => result.current.updateStep1({ age: '105', gender: 'female' }));
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toMatch(/age/i);
    });

    it('rejects when gender is not selected', () => {
      const { result } = renderHook(() => useIntakeForm());
      act(() => result.current.updateStep1({ age: '34' }));
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toMatch(/gender/i);
    });

    it('accepts age 16 (lower boundary)', () => {
      const { result } = renderHook(() => useIntakeForm());
      act(() => result.current.updateStep1({ age: '16', gender: 'female' }));
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toBeNull();
      expect(result.current.currentStep).toBe(2);
    });

    it('accepts age 100 (upper boundary)', () => {
      const { result } = renderHook(() => useIntakeForm());
      act(() => result.current.updateStep1({ age: '100', gender: 'male' }));
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toBeNull();
      expect(result.current.currentStep).toBe(2);
    });

    it('advances to step 2 on valid data', () => {
      const { result } = renderHook(() => useIntakeForm());
      act(() => result.current.updateStep1({ age: '34', gender: 'female' }));
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toBeNull();
      expect(result.current.currentStep).toBe(2);
    });

    it('clears validation error when data is updated', () => {
      const { result } = renderHook(() => useIntakeForm());
      act(() => result.current.goToNextStep()); // triggers error
      expect(result.current.validationError).not.toBeNull();
      act(() => result.current.updateStep1({ age: '34' }));
      expect(result.current.validationError).toBeNull();
    });
  });

  // ─── Step 2: Injury history ────────────────────────────────────────────────

  describe('step 2 validation (injury history)', () => {
    it('rejects when onset date is missing', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep2(result);
      act(() => result.current.updateStep2({ mechanism: 'gradual' }));
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toMatch(/injury started/i);
      expect(result.current.currentStep).toBe(2);
    });

    it('rejects when mechanism is not selected', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep2(result);
      act(() => result.current.updateStep2({ injury_onset_date: '2024-01-01' }));
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toMatch(/occurred/i);
    });

    it('advances to step 3 on valid data', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep2(result);
      act(() => result.current.updateStep2({ injury_onset_date: '2024-01-01', mechanism: 'gradual' }));
      act(() => result.current.goToNextStep());
      expect(result.current.currentStep).toBe(3);
    });

    it('accepts all mechanism values', () => {
      const mechanisms = ['gradual', 'acute', 'post_surgery', 'unknown'] as const;
      mechanisms.forEach((m) => {
        const { result } = renderHook(() => useIntakeForm());
        advanceToStep2(result);
        act(() => result.current.updateStep2({ injury_onset_date: '2024-01-01', mechanism: m }));
        act(() => result.current.goToNextStep());
        expect(result.current.currentStep).toBe(3);
      });
    });
  });

  // ─── Step 3: Treatment & background ───────────────────────────────────────

  describe('step 3 validation (treatment & background)', () => {
    it('rejects empty training background', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep3(result);
      act(() => result.current.updateStep3({ training_background: '   ' })); // whitespace only
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toMatch(/training/i);
    });

    it('prior treatment is optional', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep3(result);
      act(() => result.current.updateStep3({ training_background: 'Recreational runner' }));
      act(() => result.current.goToNextStep());
      expect(result.current.currentStep).toBe(4);
    });

    it('advances to step 4 on valid data', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep3(result);
      act(() => result.current.updateStep3({
        prior_treatment: 'Physio 3 sessions',
        training_background: '3x/week runner',
      }));
      act(() => result.current.goToNextStep());
      expect(result.current.currentStep).toBe(4);
    });
  });

  // ─── Step 4: Current status ────────────────────────────────────────────────

  describe('step 4 validation (current status)', () => {
    it('rejects when irritability level is not selected', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep4(result);
      act(() => result.current.goToNextStep()); // no irritability set
      expect(result.current.validationError).toMatch(/irritability/i);
    });

    it('accepts valid step 4 data with all irritability values', () => {
      const levels = ['low', 'moderate', 'high'] as const;
      levels.forEach((level) => {
        const { result } = renderHook(() => useIntakeForm());
        advanceToStep4(result);
        act(() => result.current.updateStep4({ irritability_level: level }));
        act(() => result.current.goToNextStep()); // validates and stays at 4 (doesn't advance — submit flow)
        expect(result.current.validationError).toBeNull();
      });
    });
  });

  // ─── Navigation ───────────────────────────────────────────────────────────

  describe('navigation', () => {
    it('goToPrevStep does not go below step 1', () => {
      const { result } = renderHook(() => useIntakeForm());
      act(() => result.current.goToPrevStep());
      expect(result.current.currentStep).toBe(1);
    });

    it('goToPrevStep goes back from step 3 to step 2', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep3(result);
      expect(result.current.currentStep).toBe(3);
      act(() => result.current.goToPrevStep());
      expect(result.current.currentStep).toBe(2);
    });

    it('goToPrevStep clears validation error', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep3(result);
      act(() => result.current.goToNextStep()); // triggers error on step 3
      expect(result.current.validationError).not.toBeNull();
      act(() => result.current.goToPrevStep());
      expect(result.current.validationError).toBeNull();
    });
  });

  // ─── Submit ───────────────────────────────────────────────────────────────

  describe('submitIntake', () => {
    it('calls saveInjuryIntake with intake fields', async () => {
      const { result } = renderHook(() => useIntakeForm());
      await fillAllStepsAndSubmit(result);

      expect(mockSaveIntake).toHaveBeenCalledTimes(1);
      expect(mockSaveIntake).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'test-user-id',
        mechanism: 'gradual',
        irritability_level: 'low',
        training_background: '3x/week runner',
      }));
    });

    it('calls saveInjuryStatus with pain baseline and symptoms', async () => {
      const { result } = renderHook(() => useIntakeForm());
      await fillAllStepsAndSubmit(result);

      expect(mockSaveStatus).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'test-user-id',
        pain_level_baseline: 2,
        current_symptoms: 'aching when sitting',
      }));
    });

    it('calls updateOnboardingStep with "goal"', async () => {
      const { result } = renderHook(() => useIntakeForm());
      await fillAllStepsAndSubmit(result);
      expect(mockUpdateStep).toHaveBeenCalledWith('test-user-id', 'goal');
    });

    it('returns null error on success', async () => {
      const { result } = renderHook(() => useIntakeForm());
      const { error } = await fillAllStepsAndSubmit(result);
      expect(error).toBeNull();
    });

    it('returns error and does not call saveInjuryStatus if saveInjuryIntake fails', async () => {
      mockSaveIntake.mockResolvedValue({ id: null, error: 'DB write error' });
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep4(result);
      act(() => result.current.updateStep4({ irritability_level: 'low' }));

      let submitResult: { error: string | null } = { error: null };
      await act(async () => { submitResult = await result.current.submitIntake(); });

      expect(submitResult.error).toBe('DB write error');
      expect(mockSaveStatus).not.toHaveBeenCalled();
      expect(mockUpdateStep).not.toHaveBeenCalled();
    });

    it('returns error and does not call updateOnboardingStep if saveInjuryStatus fails', async () => {
      mockSaveStatus.mockResolvedValue({ id: null, error: 'Status write error' });
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep4(result);
      act(() => result.current.updateStep4({ irritability_level: 'moderate' }));

      let submitResult: { error: string | null } = { error: null };
      await act(async () => { submitResult = await result.current.submitIntake(); });

      expect(submitResult.error).toBe('Status write error');
      expect(mockUpdateStep).not.toHaveBeenCalled();
    });
  });
});
