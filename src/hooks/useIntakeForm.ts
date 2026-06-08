import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { saveInjuryIntake, saveInjuryStatus } from '@/services/intake';
import { updateOnboardingStep, updateProfile } from '@/services/profiles';
import type { Database } from '@/lib/database.types';

// ─── Step definitions ────────────────────────────────────────────────────────

export const INTAKE_TOTAL_STEPS = 4;

export type IntakeStep = 1 | 2 | 3 | 4;

// Age bracket → representative midpoint integer for the profiles.age column
const AGE_BRACKET_MIDPOINT: Record<string, number> = {
  u25: 22,
  '25-34': 30,
  '35-44': 40,
  '45-54': 50,
  '55-64': 60,
  '65plus': 68,
};

// Design mechanism values → DB enum values
const MECHANISM_MAP: Record<string, Database['public']['Tables']['injury_intake']['Row']['mechanism']> = {
  gradual: 'gradual',
  acute: 'acute',
  postsurg: 'post_surgery',
  unsure: 'unknown',
};

// Design goal values → DB enum values
const GOAL_MAP: Record<string, Database['public']['Tables']['profiles']['Row']['rehab_goal']> = {
  daily: 'pain_free_daily',
  running: 'return_to_running',
  sport: 'return_to_sport',
  other: 'other',
};

// Step 1: About you
export interface Step1Data {
  age_bracket: string;    // 'u25' | '25-34' | '35-44' | '45-54' | '55-64' | '65plus'
  gender: string;         // 'female' | 'male' | 'nonbinary' | 'prefer_not'
  activity_level: string; // 'sedentary' | 'recreational' | 'regular' | 'competitive'
}

// Step 2: Your injury
export interface Step2Data {
  symptom_duration: string;  // 'u1m' | '1-3m' | '3-6m' | '6-12m' | '1-2y' | '2yplus'
  mechanism: string;         // 'gradual' | 'acute' | 'postsurg' | 'unsure'
  treatments: string[];      // optional multi-select
}

// Step 3: How you feel
export interface Step3Data {
  irritability_level: 'low' | 'moderate' | 'high' | null;
  pain_level_baseline: number;  // 0–10, defaults to 0
  symptoms: string[];           // optional multi-select
}

// Step 4: Your goal
export interface Step4Data {
  goal: string;  // 'daily' | 'running' | 'sport' | 'other'
}

export interface IntakeFormData {
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  step4: Step4Data;
}

const initialFormData: IntakeFormData = {
  step1: { age_bracket: '', gender: '', activity_level: '' },
  step2: { symptom_duration: '', mechanism: '', treatments: [] },
  step3: { irritability_level: null, pain_level_baseline: 0, symptoms: [] },
  step4: { goal: '' },
};

// ─── Validation ───────────────────────────────────────────────────────────────

function validateStep(step: IntakeStep, data: IntakeFormData): string | null {
  switch (step) {
    case 1:
      if (!data.step1.age_bracket) return 'Please select your age range.';
      if (!data.step1.gender) return 'Please select a gender.';
      if (!data.step1.activity_level) return 'Please select your activity level.';
      return null;
    case 2:
      if (!data.step2.symptom_duration) return 'Please select how long you have had symptoms.';
      if (!data.step2.mechanism) return 'Please select how your injury started.';
      return null;
    case 3:
      if (!data.step3.irritability_level) return 'Please select your irritability level.';
      return null;
    case 4:
      if (!data.step4.goal) return 'Please select a goal.';
      return null;
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
      injury_onset_date: formData.step2.symptom_duration || null,
      mechanism: MECHANISM_MAP[formData.step2.mechanism] ?? null,
      prior_treatment: formData.step2.treatments.length > 0
        ? formData.step2.treatments.join(', ')
        : null,
      irritability_level: formData.step3.irritability_level,
      training_background: formData.step1.activity_level || null,
    });

    if (intakeError) {
      setIsSubmitting(false);
      return { error: intakeError };
    }

    const { error: statusError } = await saveInjuryStatus({
      user_id: user.id,
      pain_level_baseline: formData.step3.pain_level_baseline,
      current_symptoms: formData.step3.symptoms.length > 0
        ? formData.step3.symptoms.join(', ')
        : null,
    });

    if (statusError) {
      setIsSubmitting(false);
      return { error: statusError };
    }

    const { error: profileError } = await updateProfile(user.id, {
      age: AGE_BRACKET_MIDPOINT[formData.step1.age_bracket] ?? null,
      gender: formData.step1.gender || null,
      rehab_goal: GOAL_MAP[formData.step4.goal] ?? null,
    });

    if (profileError) {
      setIsSubmitting(false);
      return { error: profileError };
    }

    // Advance directly to 'generating' — goal is now collected in step 4
    const { error: stepError } = await updateOnboardingStep(user.id, 'generating');

    setIsSubmitting(false);
    return { error: stepError };
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
