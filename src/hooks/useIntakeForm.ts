import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { saveInjuryIntake, saveInjuryStatus } from '@/services/intake';
import { updateOnboardingStep } from '@/services/profiles';
import type { Database } from '@/lib/database.types';

// ─── Step definitions ────────────────────────────────────────────────────────

export const INTAKE_TOTAL_STEPS = 4;

export type IntakeStep = 1 | 2 | 3 | 4;

// Step 1: Basic info
export interface Step1Data {
  age: string;        // stored as string for TextInput, parsed on submit
  gender: string;
}

// Step 2: Injury history
export interface Step2Data {
  injury_onset_date: string;  // ISO date string YYYY-MM-DD
  mechanism: Database['public']['Tables']['injury_intake']['Row']['mechanism'];
}

// Step 3: Treatment & background
export interface Step3Data {
  prior_treatment: string;
  training_background: string;
}

// Step 4: Current status
export interface Step4Data {
  irritability_level: Database['public']['Tables']['injury_intake']['Row']['irritability_level'];
  pain_level_baseline: number;  // 0–10 from PainScale
  current_symptoms: string;
}

export interface IntakeFormData {
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  step4: Step4Data;
}

const initialFormData: IntakeFormData = {
  step1: { age: '', gender: '' },
  step2: { injury_onset_date: '', mechanism: null },
  step3: { prior_treatment: '', training_background: '' },
  step4: { irritability_level: null, pain_level_baseline: 3, current_symptoms: '' },
};

// ─── Validation ───────────────────────────────────────────────────────────────

function validateStep(step: IntakeStep, data: IntakeFormData): string | null {
  switch (step) {
    case 1: {
      const age = parseInt(data.step1.age, 10);
      if (!data.step1.age || isNaN(age) || age < 16 || age > 100) {
        return 'Please enter a valid age (16–100).';
      }
      if (!data.step1.gender) {
        return 'Please select a gender.';
      }
      return null;
    }
    case 2: {
      if (!data.step2.injury_onset_date) {
        return 'Please enter when your injury started.';
      }
      if (!data.step2.mechanism) {
        return 'Please select how your injury occurred.';
      }
      return null;
    }
    case 3: {
      if (!data.step3.training_background.trim()) {
        return 'Please describe your training background.';
      }
      return null;
    }
    case 4: {
      if (!data.step4.irritability_level) {
        return 'Please select your irritability level.';
      }
      return null;
    }
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseIntakeFormReturn {
  currentStep: IntakeStep;
  formData: IntakeFormData;
  validationError: string | null;
  isSubmitting: boolean;
  updateStep1: (data: Partial<Step1Data>) => void;
  updateStep2: (data: Partial<Step2Data>) => void;
  updateStep3: (data: Partial<Step3Data>) => void;
  updateStep4: (data: Partial<Step4Data>) => void;
  goToNextStep: () => void;
  goToPrevStep: () => void;
  submitIntake: () => Promise<{ error: string | null }>;
}

export function useIntakeForm(): UseIntakeFormReturn {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<IntakeStep>(1);
  const [formData, setFormData] = useState<IntakeFormData>(initialFormData);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateStep1 = useCallback((data: Partial<Step1Data>) => {
    setFormData((prev) => ({ ...prev, step1: { ...prev.step1, ...data } }));
    setValidationError(null);
  }, []);

  const updateStep2 = useCallback((data: Partial<Step2Data>) => {
    setFormData((prev) => ({ ...prev, step2: { ...prev.step2, ...data } }));
    setValidationError(null);
  }, []);

  const updateStep3 = useCallback((data: Partial<Step3Data>) => {
    setFormData((prev) => ({ ...prev, step3: { ...prev.step3, ...data } }));
    setValidationError(null);
  }, []);

  const updateStep4 = useCallback((data: Partial<Step4Data>) => {
    setFormData((prev) => ({ ...prev, step4: { ...prev.step4, ...data } }));
    setValidationError(null);
  }, []);

  const goToNextStep = useCallback(() => {
    const error = validateStep(currentStep, formData);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    if (currentStep < INTAKE_TOTAL_STEPS) {
      setCurrentStep((s) => (s + 1) as IntakeStep);
    }
  }, [currentStep, formData]);

  const goToPrevStep = useCallback(() => {
    setValidationError(null);
    if (currentStep > 1) {
      setCurrentStep((s) => (s - 1) as IntakeStep);
    }
  }, [currentStep]);

  const submitIntake = useCallback(async (): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated.' };

    const finalError = validateStep(currentStep, formData);
    if (finalError) {
      setValidationError(finalError);
      return { error: finalError };
    }

    setIsSubmitting(true);

    const { error: intakeError } = await saveInjuryIntake({
      user_id: user.id,
      injury_onset_date: formData.step2.injury_onset_date || null,
      mechanism: formData.step2.mechanism,
      prior_treatment: formData.step3.prior_treatment.trim() || null,
      irritability_level: formData.step4.irritability_level,
      training_background: formData.step3.training_background.trim() || null,
    });

    if (intakeError) {
      setIsSubmitting(false);
      return { error: intakeError };
    }

    const { error: statusError } = await saveInjuryStatus({
      user_id: user.id,
      pain_level_baseline: formData.step4.pain_level_baseline,
      current_symptoms: formData.step4.current_symptoms.trim() || null,
    });

    if (statusError) {
      setIsSubmitting(false);
      return { error: statusError };
    }

    // Advance onboarding_step to 'goal' so the guard routes to goal-selection
    const { error: profileError } = await updateOnboardingStep(user.id, 'goal');

    setIsSubmitting(false);
    return { error: profileError };
  }, [user, currentStep, formData]);

  return {
    currentStep,
    formData,
    validationError,
    isSubmitting,
    updateStep1,
    updateStep2,
    updateStep3,
    updateStep4,
    goToNextStep,
    goToPrevStep,
    submitIntake,
  };
}
