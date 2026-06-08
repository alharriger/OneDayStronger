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
import { updateOnboardingStep, updateProfile } from '@/services/profiles';

const mockSaveIntake = saveInjuryIntake as jest.Mock;
const mockSaveStatus = saveInjuryStatus as jest.Mock;
const mockUpdateStep = updateOnboardingStep as jest.Mock;
const mockUpdateProfile = updateProfile as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

type HookResult = ReturnType<typeof renderHook<ReturnType<typeof useIntakeForm>, unknown>>['result'];

function advanceToStep2(result: HookResult) {
  act(() => result.current.updateStep1({ age_bracket: '35-44', gender: 'female', activity_level: 'recreational' }));
  act(() => result.current.goToNextStep());
}

function advanceToStep3(result: HookResult) {
  advanceToStep2(result);
  act(() => result.current.updateStep2({ symptom_duration: '3-6m', mechanism: 'gradual' }));
  act(() => result.current.goToNextStep());
}

function advanceToStep4(result: HookResult) {
  advanceToStep3(result);
  act(() => result.current.updateStep3({ irritability_level: 'moderate' }));
  act(() => result.current.goToNextStep());
}

async function fillAllStepsAndSubmit(result: HookResult) {
  advanceToStep4(result);
  act(() => result.current.updateStep4({ goal: 'running' }));
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
    mockUpdateProfile.mockResolvedValue({ error: null });
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

    it('initialises pain baseline to 0', () => {
      const { result } = renderHook(() => useIntakeForm());
      expect(result.current.formData.step3.pain_level_baseline).toBe(0);
    });

    it('initialises treatments and symptoms as empty arrays', () => {
      const { result } = renderHook(() => useIntakeForm());
      expect(result.current.formData.step2.treatments).toEqual([]);
      expect(result.current.formData.step3.symptoms).toEqual([]);
    });
  });

  // ─── Step 1: About you ─────────────────────────────────────────────────────

  describe('step 1 validation (about you)', () => {
    it('rejects when age bracket is not selected', () => {
      const { result } = renderHook(() => useIntakeForm());
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toMatch(/age/i);
      expect(result.current.currentStep).toBe(1);
    });

    it('rejects when gender is not selected', () => {
      const { result } = renderHook(() => useIntakeForm());
      act(() => result.current.updateStep1({ age_bracket: '35-44' }));
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toMatch(/gender/i);
    });

    it('rejects when activity level is not selected', () => {
      const { result } = renderHook(() => useIntakeForm());
      act(() => result.current.updateStep1({ age_bracket: '35-44', gender: 'female' }));
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toMatch(/activity/i);
    });

    it('advances to step 2 when all three fields are selected', () => {
      const { result } = renderHook(() => useIntakeForm());
      act(() => result.current.updateStep1({ age_bracket: '25-34', gender: 'male', activity_level: 'regular' }));
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toBeNull();
      expect(result.current.currentStep).toBe(2);
    });

    it('accepts all age bracket values', () => {
      const brackets = ['u25', '25-34', '35-44', '45-54', '55-64', '65plus'];
      brackets.forEach((bracket) => {
        const { result } = renderHook(() => useIntakeForm());
        act(() => result.current.updateStep1({ age_bracket: bracket, gender: 'female', activity_level: 'sedentary' }));
        act(() => result.current.goToNextStep());
        expect(result.current.currentStep).toBe(2);
      });
    });

    it('accepts all activity level values', () => {
      const levels = ['sedentary', 'recreational', 'regular', 'competitive'];
      levels.forEach((level) => {
        const { result } = renderHook(() => useIntakeForm());
        act(() => result.current.updateStep1({ age_bracket: '35-44', gender: 'male', activity_level: level }));
        act(() => result.current.goToNextStep());
        expect(result.current.currentStep).toBe(2);
      });
    });

    it('clears validation error when data is updated', () => {
      const { result } = renderHook(() => useIntakeForm());
      act(() => result.current.goToNextStep()); // triggers error
      expect(result.current.validationError).not.toBeNull();
      act(() => result.current.updateStep1({ age_bracket: '35-44' }));
      expect(result.current.validationError).toBeNull();
    });
  });

  // ─── Step 2: Your injury ───────────────────────────────────────────────────

  describe('step 2 validation (your injury)', () => {
    it('rejects when symptom duration is not selected', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep2(result);
      act(() => result.current.updateStep2({ mechanism: 'gradual' }));
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toMatch(/symptom/i);
      expect(result.current.currentStep).toBe(2);
    });

    it('rejects when mechanism is not selected', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep2(result);
      act(() => result.current.updateStep2({ symptom_duration: '3-6m' }));
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toMatch(/started/i);
    });

    it('advances to step 3 when required fields are selected', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep2(result);
      act(() => result.current.updateStep2({ symptom_duration: '1-3m', mechanism: 'acute' }));
      act(() => result.current.goToNextStep());
      expect(result.current.currentStep).toBe(3);
    });

    it('treatments are optional', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep2(result);
      act(() => result.current.updateStep2({ symptom_duration: '6-12m', mechanism: 'gradual' }));
      act(() => result.current.goToNextStep());
      expect(result.current.currentStep).toBe(3);
    });

    it('accepts all duration values', () => {
      const durations = ['u1m', '1-3m', '3-6m', '6-12m', '1-2y', '2yplus'];
      durations.forEach((duration) => {
        const { result } = renderHook(() => useIntakeForm());
        advanceToStep2(result);
        act(() => result.current.updateStep2({ symptom_duration: duration, mechanism: 'gradual' }));
        act(() => result.current.goToNextStep());
        expect(result.current.currentStep).toBe(3);
      });
    });

    it('accepts all mechanism values', () => {
      const mechanisms = ['gradual', 'acute', 'postsurg', 'unsure'];
      mechanisms.forEach((m) => {
        const { result } = renderHook(() => useIntakeForm());
        advanceToStep2(result);
        act(() => result.current.updateStep2({ symptom_duration: '3-6m', mechanism: m }));
        act(() => result.current.goToNextStep());
        expect(result.current.currentStep).toBe(3);
      });
    });

    it('stores multiple treatments', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep2(result);
      act(() => result.current.updateStep2({ treatments: ['physio', 'rest'] }));
      expect(result.current.formData.step2.treatments).toEqual(['physio', 'rest']);
    });
  });

  // ─── Step 3: How you feel ──────────────────────────────────────────────────

  describe('step 3 validation (how you feel)', () => {
    it('rejects when irritability level is not selected', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep3(result);
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toMatch(/irritability/i);
      expect(result.current.currentStep).toBe(3);
    });

    it('advances to step 4 when irritability is selected', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep3(result);
      act(() => result.current.updateStep3({ irritability_level: 'low' }));
      act(() => result.current.goToNextStep());
      expect(result.current.currentStep).toBe(4);
    });

    it('symptoms are optional', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep3(result);
      act(() => result.current.updateStep3({ irritability_level: 'high' }));
      act(() => result.current.goToNextStep());
      expect(result.current.currentStep).toBe(4);
    });

    it('accepts all irritability values', () => {
      const levels = ['low', 'moderate', 'high'] as const;
      levels.forEach((level) => {
        const { result } = renderHook(() => useIntakeForm());
        advanceToStep3(result);
        act(() => result.current.updateStep3({ irritability_level: level }));
        act(() => result.current.goToNextStep());
        expect(result.current.currentStep).toBe(4);
      });
    });

    it('stores multiple symptoms', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep3(result);
      act(() => result.current.updateStep3({ symptoms: ['sitting', 'morning'] }));
      expect(result.current.formData.step3.symptoms).toEqual(['sitting', 'morning']);
    });

    it('pain defaults to 0 and accepts values 0–10', () => {
      const { result } = renderHook(() => useIntakeForm());
      expect(result.current.formData.step3.pain_level_baseline).toBe(0);
      act(() => result.current.updateStep3({ pain_level_baseline: 7 }));
      expect(result.current.formData.step3.pain_level_baseline).toBe(7);
    });
  });

  // ─── Step 4: Your goal ─────────────────────────────────────────────────────

  describe('step 4 validation (your goal)', () => {
    it('rejects when no goal is selected', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep4(result);
      act(() => result.current.goToNextStep());
      expect(result.current.validationError).toMatch(/goal/i);
    });

    it('accepts all goal values', () => {
      const goals = ['daily', 'running', 'sport', 'other'];
      goals.forEach((goal) => {
        const { result } = renderHook(() => useIntakeForm());
        advanceToStep4(result);
        act(() => result.current.updateStep4({ goal }));
        // step 4 is the last step — goToNextStep won't advance further but should clear error
        act(() => result.current.goToNextStep());
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
      act(() => result.current.goToPrevStep());
      expect(result.current.currentStep).toBe(2);
    });

    it('goToPrevStep clears validation error', () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep3(result);
      act(() => result.current.goToNextStep()); // triggers irritability error
      expect(result.current.validationError).not.toBeNull();
      act(() => result.current.goToPrevStep());
      expect(result.current.validationError).toBeNull();
    });
  });

  // ─── Submit ───────────────────────────────────────────────────────────────

  describe('submitIntake', () => {
    it('calls saveInjuryIntake with correctly mapped fields', async () => {
      const { result } = renderHook(() => useIntakeForm());
      // Fill with specific values to verify mapping
      act(() => result.current.updateStep1({ age_bracket: '35-44', gender: 'female', activity_level: 'recreational' }));
      act(() => result.current.goToNextStep());
      act(() => result.current.updateStep2({ symptom_duration: '3-6m', mechanism: 'postsurg', treatments: ['physio', 'rest'] }));
      act(() => result.current.goToNextStep());
      act(() => result.current.updateStep3({ irritability_level: 'low', pain_level_baseline: 3, symptoms: ['sitting'] }));
      act(() => result.current.goToNextStep());
      act(() => result.current.updateStep4({ goal: 'running' }));
      await act(async () => { await result.current.submitIntake(); });

      expect(mockSaveIntake).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'test-user-id',
        injury_onset_date: '3-6m',
        mechanism: 'post_surgery',    // postsurg → post_surgery
        prior_treatment: 'physio, rest',
        irritability_level: 'low',
        training_background: 'recreational',
      }));
    });

    it('calls saveInjuryStatus with pain and joined symptoms', async () => {
      const { result } = renderHook(() => useIntakeForm());
      await fillAllStepsAndSubmit(result);

      expect(mockSaveStatus).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'test-user-id',
        pain_level_baseline: 0,
        current_symptoms: null,  // no symptoms selected in fillAllStepsAndSubmit
      }));
    });

    it('calls updateProfile with age midpoint, gender, and mapped rehab_goal', async () => {
      const { result } = renderHook(() => useIntakeForm());
      await fillAllStepsAndSubmit(result);

      expect(mockUpdateProfile).toHaveBeenCalledWith('test-user-id', expect.objectContaining({
        age: 40,            // '35-44' bracket → midpoint 40
        gender: 'female',
        rehab_goal: 'return_to_running',  // 'running' → 'return_to_running'
      }));
    });

    it('calls updateOnboardingStep with "generating" (skips goal step)', async () => {
      const { result } = renderHook(() => useIntakeForm());
      await fillAllStepsAndSubmit(result);
      expect(mockUpdateStep).toHaveBeenCalledWith('test-user-id', 'generating');
    });

    it('maps goal "daily" to "pain_free_daily"', async () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep4(result);
      act(() => result.current.updateStep4({ goal: 'daily' }));
      await act(async () => { await result.current.submitIntake(); });
      expect(mockUpdateProfile).toHaveBeenCalledWith('test-user-id', expect.objectContaining({
        rehab_goal: 'pain_free_daily',
      }));
    });

    it('maps goal "sport" to "return_to_sport"', async () => {
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep4(result);
      act(() => result.current.updateStep4({ goal: 'sport' }));
      await act(async () => { await result.current.submitIntake(); });
      expect(mockUpdateProfile).toHaveBeenCalledWith('test-user-id', expect.objectContaining({
        rehab_goal: 'return_to_sport',
      }));
    });

    it('maps mechanism "unsure" to "unknown"', async () => {
      const { result } = renderHook(() => useIntakeForm());
      act(() => result.current.updateStep1({ age_bracket: '35-44', gender: 'female', activity_level: 'recreational' }));
      act(() => result.current.goToNextStep());
      act(() => result.current.updateStep2({ symptom_duration: '3-6m', mechanism: 'unsure' }));
      act(() => result.current.goToNextStep());
      act(() => result.current.updateStep3({ irritability_level: 'low' }));
      act(() => result.current.goToNextStep());
      act(() => result.current.updateStep4({ goal: 'other' }));
      await act(async () => { await result.current.submitIntake(); });
      expect(mockSaveIntake).toHaveBeenCalledWith(expect.objectContaining({
        mechanism: 'unknown',
      }));
    });

    it('stores empty treatments as null', async () => {
      const { result } = renderHook(() => useIntakeForm());
      await fillAllStepsAndSubmit(result);
      expect(mockSaveIntake).toHaveBeenCalledWith(expect.objectContaining({
        prior_treatment: null,
      }));
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
      act(() => result.current.updateStep4({ goal: 'daily' }));
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
      act(() => result.current.updateStep4({ goal: 'sport' }));
      let submitResult: { error: string | null } = { error: null };
      await act(async () => { submitResult = await result.current.submitIntake(); });
      expect(submitResult.error).toBe('Status write error');
      expect(mockUpdateStep).not.toHaveBeenCalled();
    });

    it('returns error and does not call updateOnboardingStep if updateProfile fails', async () => {
      mockUpdateProfile.mockResolvedValue({ error: 'Profile update error' });
      const { result } = renderHook(() => useIntakeForm());
      advanceToStep4(result);
      act(() => result.current.updateStep4({ goal: 'other' }));
      let submitResult: { error: string | null } = { error: null };
      await act(async () => { submitResult = await result.current.submitIntake(); });
      expect(submitResult.error).toBe('Profile update error');
      expect(mockUpdateStep).not.toHaveBeenCalled();
    });
  });
});
