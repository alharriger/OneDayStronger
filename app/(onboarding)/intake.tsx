import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  FormField,
  SegmentedSelector,
  PainScale,
} from '@/components/ui';
import { Colors, Typography, Spacing } from '@/theme';
import {
  useIntakeForm,
  INTAKE_TOTAL_STEPS,
  type IntakeStep,
} from '@/hooks/useIntakeForm';

// ─── Step progress dots ───────────────────────────────────────────────────────

function StepDots({ current, total }: { current: IntakeStep; total: number }) {
  return (
    <View
      style={dots.row}
      accessibilityLabel={`Step ${current} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[dots.dot, i + 1 === current ? dots.active : dots.inactive]}
        />
      ))}
    </View>
  );
}

const dots = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.space2, justifyContent: 'center' } as ViewStyle,
  dot: { width: 8, height: 8, borderRadius: 4 } as ViewStyle,
  active: { backgroundColor: Colors.primary } as ViewStyle,
  inactive: { backgroundColor: Colors.bg.surface } as ViewStyle,
});

// ─── Mechanism options ────────────────────────────────────────────────────────

const MECHANISM_OPTIONS = [
  { value: 'gradual', label: 'Gradual' },
  { value: 'acute', label: 'Acute' },
  { value: 'post_surgery', label: 'Post-surgery' },
  { value: 'unknown', label: 'Not sure' },
] as const;

const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const IRRITABILITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
] as const;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function IntakeScreen() {
  const router = useRouter();
  const {
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
  } = useIntakeForm();

  async function handleNext() {
    if (currentStep < INTAKE_TOTAL_STEPS) {
      goToNextStep();
    } else {
      const { error } = await submitIntake();
      if (!error) {
        router.replace('/(onboarding)/goal-selection');
      } else {
        console.error('[intake] submitIntake error:', error);
        Alert.alert('Could not save', error);
      }
    }
  }

  function handleBack() {
    if (currentStep === 1) {
      router.back();
    } else {
      goToPrevStep();
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backTouchable}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>
        <StepDots current={currentStep} total={INTAKE_TOTAL_STEPS} />
        {/* Spacer to center dots */}
        <View style={styles.backTouchable} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {currentStep === 1 && (
          <Step1
            data={formData.step1}
            onUpdate={updateStep1}
            error={validationError}
          />
        )}
        {currentStep === 2 && (
          <Step2
            data={formData.step2}
            onUpdate={updateStep2}
            error={validationError}
          />
        )}
        {currentStep === 3 && (
          <Step3
            data={formData.step3}
            onUpdate={updateStep3}
            error={validationError}
          />
        )}
        {currentStep === 4 && (
          <Step4
            data={formData.step4}
            onUpdate={updateStep4}
            error={validationError}
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={currentStep === INTAKE_TOTAL_STEPS ? 'Continue to goals' : 'Next'}
          onPress={handleNext}
          loading={isSubmitting}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── Step 1: Basic info ───────────────────────────────────────────────────────

function Step1({
  data,
  onUpdate,
  error,
}: {
  data: ReturnType<typeof useIntakeForm>['formData']['step1'];
  onUpdate: (d: Partial<typeof data>) => void;
  error: string | null;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Let's start with the basics</Text>
      <Text style={styles.stepSubtitle}>
        This helps us calibrate the intensity of your plan.
      </Text>
      <View style={styles.fields}>
        <FormField
          label="Your age"
          value={data.age}
          onChangeText={(v) => onUpdate({ age: v })}
          keyboardType="number-pad"
          placeholder="e.g. 34"
          returnKeyType="done"
          error={error?.includes('age') ? error : undefined}
        />
        <View>
          <Text style={styles.fieldLabel}>Gender</Text>
          <SegmentedSelector
            options={GENDER_OPTIONS}
            selected={data.gender || null}
            onChange={(v) => onUpdate({ gender: v })}
          />
        </View>
        {error && !error.includes('age') && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </View>
    </View>
  );
}

// ─── Step 2: Injury history ───────────────────────────────────────────────────

function Step2({
  data,
  onUpdate,
  error,
}: {
  data: ReturnType<typeof useIntakeForm>['formData']['step2'];
  onUpdate: (d: Partial<typeof data>) => void;
  error: string | null;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>About your injury</Text>
      <Text style={styles.stepSubtitle}>
        Understanding your injury history helps us set the right starting point.
      </Text>
      <View style={styles.fields}>
        <FormField
          label="When did your symptoms start? (approximate)"
          value={data.injury_onset_date}
          onChangeText={(v) => onUpdate({ injury_onset_date: v })}
          placeholder="e.g. 2024-09-15 or 'about 6 months ago'"
          returnKeyType="done"
          error={error?.includes('onset') ? error : undefined}
        />
        <View>
          <Text style={styles.fieldLabel}>How did the injury occur?</Text>
          <SegmentedSelector
            options={[...MECHANISM_OPTIONS]}
            selected={data.mechanism}
            onChange={(v) =>
              onUpdate({ mechanism: v as typeof data.mechanism })
            }
          />
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </View>
  );
}

// ─── Step 3: Treatment & background ──────────────────────────────────────────

function Step3({
  data,
  onUpdate,
  error,
}: {
  data: ReturnType<typeof useIntakeForm>['formData']['step3'];
  onUpdate: (d: Partial<typeof data>) => void;
  error: string | null;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Treatment & training</Text>
      <Text style={styles.stepSubtitle}>
        Tell us what you've already tried and what your activity background looks like.
      </Text>
      <View style={styles.fields}>
        <FormField
          label="Any prior treatment? (optional)"
          value={data.prior_treatment}
          onChangeText={(v) => onUpdate({ prior_treatment: v })}
          multiline
          placeholder="e.g. physio sessions, steroid injection, rest only, nothing yet"
          returnKeyType="default"
        />
        <FormField
          label="Your training background"
          value={data.training_background}
          onChangeText={(v) => onUpdate({ training_background: v })}
          multiline
          placeholder="e.g. recreational runner, 3x/week strength training, mostly sedentary"
          returnKeyType="default"
          error={error?.includes('training') ? error : undefined}
        />
        {error && !error.includes('training') && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </View>
    </View>
  );
}

// ─── Step 4: Current status ───────────────────────────────────────────────────

function Step4({
  data,
  onUpdate,
  error,
}: {
  data: ReturnType<typeof useIntakeForm>['formData']['step4'];
  onUpdate: (d: Partial<typeof data>) => void;
  error: string | null;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>How are you feeling now?</Text>
      <Text style={styles.stepSubtitle}>
        This sets your starting baseline. Be honest — there's no wrong answer.
      </Text>
      <View style={styles.fields}>
        <View>
          <Text style={styles.fieldLabel}>How irritable is your hamstring right now?</Text>
          <Text style={styles.fieldHint}>
            Low = minor discomfort that settles quickly.{'\n'}
            Moderate = noticeable pain that lingers after activity.{'\n'}
            High = pain that flares easily and takes days to settle.
          </Text>
          <SegmentedSelector
            options={[...IRRITABILITY_OPTIONS]}
            selected={data.irritability_level}
            onChange={(v) =>
              onUpdate({ irritability_level: v as typeof data.irritability_level })
            }
          />
        </View>

        <PainScale
          value={data.pain_level_baseline}
          onChange={(v) => onUpdate({ pain_level_baseline: v })}
          label="Pain at rest right now (0–10)"
        />

        <FormField
          label="Any other symptoms? (optional)"
          value={data.current_symptoms}
          onChangeText={(v) => onUpdate({ current_symptoms: v })}
          multiline
          placeholder="e.g. numbness, tingling, sharp pain with sitting, morning stiffness"
          returnKeyType="default"
        />

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </View>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg.base,
  } as ViewStyle,

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.space5,
    paddingVertical: Spacing.space4,
  } as ViewStyle,

  backTouchable: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  } as ViewStyle,

  backLabel: {
    ...Typography.labelLarge,
    color: Colors.text.secondary,
  } as TextStyle,

  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.space5,
    paddingBottom: Spacing.space8,
  } as ViewStyle,

  footer: {
    paddingHorizontal: Spacing.space5,
    paddingBottom: Spacing.space6,
    paddingTop: Spacing.space4,
  } as ViewStyle,

  stepContainer: {
    gap: Spacing.space6,
  } as ViewStyle,

  stepTitle: {
    ...Typography.h1,
    color: Colors.text.primary,
    marginTop: Spacing.space2,
  } as TextStyle,

  stepSubtitle: {
    ...Typography.bodyLarge,
    color: Colors.text.secondary,
    marginTop: -Spacing.space2,
  } as TextStyle,

  fields: {
    gap: Spacing.space6,
  } as ViewStyle,

  fieldLabel: {
    ...Typography.label,
    color: Colors.text.secondary,
    marginBottom: Spacing.space2,
  } as TextStyle,

  fieldHint: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginBottom: Spacing.space3,
  } as TextStyle,

  errorText: {
    ...Typography.bodySmall,
    color: Colors.semantic.danger,
  } as TextStyle,
});
