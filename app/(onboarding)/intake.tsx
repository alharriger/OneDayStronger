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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, PainScale } from '@/components/ui';
import { Colors, Typography, Spacing, FontFamily } from '@/theme';
import {
  useIntakeForm,
  INTAKE_TOTAL_STEPS,
} from '@/hooks/useIntakeForm';
import type { Database } from '@/lib/database.types';

// ─── Local selection components ───────────────────────────────────────────────

interface PillOption {
  value: string;
  label: string;
}

function OBPills({ options, value, onChange, cols = 2 }: {
  options: PillOption[];
  value: string;
  onChange: (v: string) => void;
  cols?: number;
}) {
  const rows: PillOption[][] = [];
  for (let i = 0; i < options.length; i += cols) {
    rows.push(options.slice(i, i + cols));
  }
  return (
    <View style={pillStyles.grid}>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={pillStyles.gridRow}>
          {row.map((o) => {
            const selected = o.value === value;
            return (
              <TouchableOpacity
                key={o.value}
                onPress={() => onChange(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={o.label}
                style={[pillStyles.pill, selected && pillStyles.pillSelected]}
              >
                <Text style={[pillStyles.pillLabel, selected && pillStyles.pillLabelSelected]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          {Array.from({ length: cols - row.length }, (_, i) => (
            <View key={`sp-${i}`} style={pillStyles.pillSpacer} />
          ))}
        </View>
      ))}
    </View>
  );
}

const pillStyles = StyleSheet.create({
  grid: {
    gap: 8,
  } as ViewStyle,
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  } as ViewStyle,
  pill: {
    flex: 1,
    height: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border.faint,
    backgroundColor: 'transparent',
    alignItems: 'flex-start',
    justifyContent: 'center',
  } as ViewStyle,
  pillSpacer: {
    flex: 1,
  } as ViewStyle,
  pillSelected: {
    backgroundColor: 'rgba(78,107,130,0.80)',
    borderColor: Colors.primary,
  } as ViewStyle,
  pillLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.text.primary,
  } as TextStyle,
  pillLabelSelected: {
    fontFamily: FontFamily.bold,
    color: Colors.text.onDark,
    letterSpacing: 0.13,
  } as TextStyle,
});

function OBChips({ options, value, onChange }: {
  options: PillOption[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <View style={chipStyles.row}>
      {options.map((o) => {
        const selected = value.includes(o.value);
        return (
          <TouchableOpacity
            key={o.value}
            onPress={() => toggle(o.value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.label}
            style={[chipStyles.chip, selected && chipStyles.chipSelected]}
          >
            <Text style={[chipStyles.chipLabel, selected && chipStyles.chipLabelSelected]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  } as ViewStyle,
  chip: {
    height: 36,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: Colors.border.faint,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  chipSelected: {
    backgroundColor: 'rgba(78,107,130,0.80)',
    borderColor: Colors.primary,
  } as ViewStyle,
  chipLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.text.secondary,
  } as TextStyle,
  chipLabelSelected: {
    fontFamily: FontFamily.bold,
    color: Colors.text.onDark,
  } as TextStyle,
});

// ─── Shell components ─────────────────────────────────────────────────────────

function ProgressBars({ step }: { step: number }) {
  return (
    <View style={shellStyles.progressRow}>
      {Array.from({ length: INTAKE_TOTAL_STEPS }, (_, i) => (
        <View
          key={i}
          style={[
            shellStyles.progressSegment,
            i < step ? shellStyles.progressFilled : shellStyles.progressEmpty,
          ]}
        />
      ))}
    </View>
  );
}

function OBEyebrow({ children, optional }: { children: string; optional?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <Text style={shellStyles.eyebrow}>{children}</Text>
      {optional && (
        <Text style={shellStyles.eyebrowOptional}>optional</Text>
      )}
    </View>
  );
}

function OBDivider() {
  return <View style={shellStyles.divider} />;
}

function FieldBlock({ label, optional, children }: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={shellStyles.fieldBlock}>
      <OBEyebrow optional={optional}>{label}</OBEyebrow>
      {children}
    </View>
  );
}

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

  const STEP_TITLES = ['About you', 'Your injury', 'How you feel', "What's your goal?"];
  const STEP_SUBTITLES = [
    "Helps us calibrate your plan's intensity.",
    'Helps us set the right starting point.',
    "Sets your baseline. Be honest — there's no wrong answer.",
    'This shapes the entire plan. You can update it later.',
  ];

  async function handleNext() {
    if (currentStep < INTAKE_TOTAL_STEPS) {
      goToNextStep();
    } else {
      const { error } = await submitIntake();
      if (!error) {
        router.replace('/(onboarding)/plan-generation');
      } else {
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

  const isLastStep = currentStep === INTAKE_TOTAL_STEPS;
  const ctaLabel = isLastStep ? 'Build my plan' : 'Next';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>
        <ProgressBars step={currentStep} />
      </View>

      {/* Title block */}
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{STEP_TITLES[currentStep - 1]}</Text>
        <Text style={styles.subtitle}>{STEP_SUBTITLES[currentStep - 1]}</Text>
      </View>

      <View style={styles.hairline} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {currentStep === 1 && (
          <Step1 data={formData.step1} onUpdate={updateStep1} />
        )}
        {currentStep === 2 && (
          <Step2 data={formData.step2} onUpdate={updateStep2} />
        )}
        {currentStep === 3 && (
          <Step3 data={formData.step3} onUpdate={updateStep3} />
        )}
        {currentStep === 4 && (
          <Step4 data={formData.step4} onUpdate={updateStep4} />
        )}

        {validationError && (
          <Text style={styles.errorText}>{validationError}</Text>
        )}
        <View style={{ height: 12 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          label={ctaLabel}
          onPress={handleNext}
          loading={isSubmitting}
          arrow="→"
        />
      </View>
    </SafeAreaView>
  );
}

// ─── Step 1: About you ────────────────────────────────────────────────────────

const AGE_OPTIONS: PillOption[] = [
  { value: 'u25', label: 'Under 25' },
  { value: '25-34', label: '25–34' },
  { value: '35-44', label: '35–44' },
  { value: '45-54', label: '45–54' },
  { value: '55-64', label: '55–64' },
  { value: '65plus', label: '65+' },
];

const GENDER_OPTIONS: PillOption[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'nonbinary', label: 'Non-binary' },
  { value: 'prefer_not', label: 'Prefer not to say' },
];

const ACTIVITY_OPTIONS: PillOption[] = [
  { value: 'sedentary', label: 'Mostly sedentary' },
  { value: 'recreational', label: 'Recreational' },
  { value: 'regular', label: 'Regular gym / sport' },
  { value: 'competitive', label: 'Competitive athlete' },
];

function Step1({
  data,
  onUpdate,
}: {
  data: ReturnType<typeof useIntakeForm>['formData']['step1'];
  onUpdate: (d: Partial<typeof data>) => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <FieldBlock label="Your age">
        <OBPills cols={3} options={AGE_OPTIONS} value={data.age_bracket} onChange={(v) => onUpdate({ age_bracket: v })} />
      </FieldBlock>

      <OBDivider />

      <FieldBlock label="Gender">
        <OBPills cols={2} options={GENDER_OPTIONS} value={data.gender} onChange={(v) => onUpdate({ gender: v })} />
      </FieldBlock>

      <OBDivider />

      <FieldBlock label="Activity level">
        <OBPills cols={2} options={ACTIVITY_OPTIONS} value={data.activity_level} onChange={(v) => onUpdate({ activity_level: v })} />
      </FieldBlock>
    </View>
  );
}

// ─── Step 2: Your injury ──────────────────────────────────────────────────────

const DURATION_OPTIONS: PillOption[] = [
  { value: 'u1m', label: 'Under 1 month' },
  { value: '1-3m', label: '1–3 months' },
  { value: '3-6m', label: '3–6 months' },
  { value: '6-12m', label: '6–12 months' },
  { value: '1-2y', label: '1–2 years' },
  { value: '2yplus', label: '2+ years' },
];

const MECHANISM_OPTIONS: PillOption[] = [
  { value: 'gradual', label: 'Gradually' },
  { value: 'acute', label: 'Acute event' },
  { value: 'postsurg', label: 'Post-surgery' },
  { value: 'unsure', label: 'Not sure' },
];

const TREATMENT_OPTIONS: PillOption[] = [
  { value: 'nothing', label: 'Nothing yet' },
  { value: 'physio', label: 'Physiotherapy' },
  { value: 'steroid', label: 'Steroid injection' },
  { value: 'rest', label: 'Rest only' },
  { value: 'surgery', label: 'Surgery' },
  { value: 'other', label: 'Other' },
];

function Step2({
  data,
  onUpdate,
}: {
  data: ReturnType<typeof useIntakeForm>['formData']['step2'];
  onUpdate: (d: Partial<typeof data>) => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <FieldBlock label="How long have you had symptoms?">
        <OBPills cols={2} options={DURATION_OPTIONS} value={data.symptom_duration} onChange={(v) => onUpdate({ symptom_duration: v })} />
      </FieldBlock>

      <OBDivider />

      <FieldBlock label="How did it start?">
        <OBPills cols={2} options={MECHANISM_OPTIONS} value={data.mechanism} onChange={(v) => onUpdate({ mechanism: v })} />
      </FieldBlock>

      <OBDivider />

      <FieldBlock label="Treatments tried" optional>
        <OBChips options={TREATMENT_OPTIONS} value={data.treatments} onChange={(v) => onUpdate({ treatments: v })} />
      </FieldBlock>
    </View>
  );
}

// ─── Step 3: How you feel ─────────────────────────────────────────────────────

const IRRITABILITY_OPTIONS: PillOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
];

const SYMPTOM_OPTIONS: PillOption[] = [
  { value: 'sitting', label: 'Sitting pain' },
  { value: 'morning', label: 'Morning stiffness' },
  { value: 'numbness', label: 'Numbness' },
  { value: 'tingling', label: 'Tingling' },
  { value: 'radiating', label: 'Radiating pain' },
  { value: 'none', label: 'None of these' },
];

function Step3({
  data,
  onUpdate,
}: {
  data: ReturnType<typeof useIntakeForm>['formData']['step3'];
  onUpdate: (d: Partial<typeof data>) => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <FieldBlock label="Hamstring irritability">
        <Text style={styles.fieldHint}>
          <Text style={styles.fieldHintBold}>Low</Text>
          {' — minor discomfort that settles quickly · '}
          <Text style={styles.fieldHintBold}>Moderate</Text>
          {' — noticeable, lingers after activity · '}
          <Text style={styles.fieldHintBold}>High</Text>
          {' — flares easily, days to calm'}
        </Text>
        <OBPills
          cols={3}
          options={IRRITABILITY_OPTIONS}
          value={data.irritability_level ?? ''}
          onChange={(v) => onUpdate({ irritability_level: v as typeof data.irritability_level })}
        />
      </FieldBlock>

      <OBDivider />

      <PainScale
        value={data.pain_level_baseline}
        onValueChange={(v) => onUpdate({ pain_level_baseline: v })}
        label="Pain at rest right now"
      />

      <OBDivider />

      <FieldBlock label="Other symptoms" optional>
        <OBChips options={SYMPTOM_OPTIONS} value={data.symptoms} onChange={(v) => onUpdate({ symptoms: v })} />
      </FieldBlock>
    </View>
  );
}

// ─── Step 4: Your goal ────────────────────────────────────────────────────────

type RehabGoalDesign = 'daily' | 'running' | 'sport' | 'other';

interface GoalOption {
  value: RehabGoalDesign;
  title: string;
  description: string;
}

const GOAL_OPTIONS: GoalOption[] = [
  {
    value: 'daily',
    title: 'Pain-free daily life',
    description: 'Reduce pain with everyday activities like sitting, walking, and climbing stairs.',
  },
  {
    value: 'running',
    title: 'Return to running',
    description: 'Build back to comfortable running, starting from where you are now.',
  },
  {
    value: 'sport',
    title: 'Return to sport',
    description: 'Get back to your sport — field sports, cycling, gym training, or other athletic activity.',
  },
  {
    value: 'other',
    title: 'Something else',
    description: "Your goal is unique. We'll start conservatively and adapt as we learn more.",
  },
];

function OBGoalCard({ option, selected, onSelect }: {
  option: GoalOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={option.title}
      accessibilityHint={option.description}
      style={[goalStyles.card, selected && goalStyles.cardSelected]}
    >
      <Text style={[goalStyles.cardTitle, selected && goalStyles.cardTitleSelected]}>
        {option.title}
      </Text>
      <Text style={goalStyles.cardDesc}>{option.description}</Text>
    </TouchableOpacity>
  );
}

const goalStyles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.faint,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    backgroundColor: 'transparent',
  } as ViewStyle,
  cardSelected: {
    backgroundColor: Colors.bg.surfaceRaised,
    borderColor: Colors.primary,
    borderLeftColor: Colors.primary,
  } as ViewStyle,
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: Colors.text.primary,
    marginBottom: 5,
  } as TextStyle,
  cardTitleSelected: {
    color: Colors.primaryDark,
  } as TextStyle,
  cardDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 13 * 1.45,
  } as TextStyle,
});

function Step4({
  data,
  onUpdate,
}: {
  data: ReturnType<typeof useIntakeForm>['formData']['step4'];
  onUpdate: (d: Partial<typeof data>) => void;
}) {
  return (
    <View style={[styles.stepContainer, { gap: 10 }]}>
      {GOAL_OPTIONS.map((option) => (
        <OBGoalCard
          key={option.value}
          option={option}
          selected={data.goal === option.value}
          onSelect={() => onUpdate({ goal: option.value })}
        />
      ))}
    </View>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const shellStyles = StyleSheet.create({
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
  } as ViewStyle,
  progressSegment: {
    flex: 1,
    height: 3,
  } as ViewStyle,
  progressFilled: {
    backgroundColor: Colors.moss,
  } as ViewStyle,
  progressEmpty: {
    backgroundColor: Colors.bg.surfaceStrong,
  } as ViewStyle,
  eyebrow: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    letterSpacing: 10 * 0.16,
    textTransform: 'uppercase',
    color: Colors.text.muted,
    lineHeight: 10,
  } as TextStyle,
  eyebrowOptional: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    color: Colors.text.muted,
    opacity: 0.75,
  } as TextStyle,
  divider: {
    height: 1,
    backgroundColor: Colors.border.faint,
  } as ViewStyle,
  fieldBlock: {
    gap: 10,
  } as ViewStyle,
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg.base,
  } as ViewStyle,

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: Spacing.space4,
    paddingBottom: Spacing.space4,
  } as ViewStyle,

  backLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    letterSpacing: 11 * 0.12,
    textTransform: 'uppercase',
    color: Colors.text.secondary,
  } as TextStyle,

  titleBlock: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing.space4,
    gap: 8,
  } as ViewStyle,

  title: {
    fontFamily: FontFamily.black,
    fontSize: 34,
    lineHeight: 34 * 0.97,
    letterSpacing: 34 * -0.025,
    color: Colors.text.primary,
  } as TextStyle,

  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 14 * 1.45,
    color: Colors.text.secondary,
  } as TextStyle,

  hairline: {
    height: 1,
    backgroundColor: Colors.border.default,
  } as ViewStyle,

  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: 18,
  } as ViewStyle,

  stepContainer: {
    gap: 20,
  } as ViewStyle,

  fieldHint: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.text.muted,
    lineHeight: 12 * 1.55,
    marginBottom: 4,
  } as TextStyle,

  fieldHintBold: {
    fontFamily: FontFamily.bold,
    color: Colors.text.secondary,
  } as TextStyle,

  errorText: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.semantic.danger,
    marginTop: Spacing.space4,
  } as TextStyle,

  footer: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: 42,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border.faint,
    backgroundColor: Colors.bg.base,
  } as ViewStyle,
});
