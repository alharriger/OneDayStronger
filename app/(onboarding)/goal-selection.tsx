import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { updateProfile } from '@/services/profiles';
import { updateOnboardingStep } from '@/services/profiles';
import type { Database } from '@/lib/database.types';

type RehabGoal = NonNullable<Database['public']['Tables']['profiles']['Row']['rehab_goal']>;

interface GoalOption {
  value: RehabGoal;
  title: string;
  description: string;
}

const GOAL_OPTIONS: GoalOption[] = [
  {
    value: 'pain_free_daily',
    title: 'Pain-free daily life',
    description: 'Reduce pain with everyday activities like sitting, walking, and climbing stairs.',
  },
  {
    value: 'return_to_running',
    title: 'Return to running',
    description: 'Build back to comfortable running, starting from where you are now.',
  },
  {
    value: 'return_to_sport',
    title: 'Return to sport',
    description: 'Get back to your sport — field sports, cycling, gym training, or other athletic activity.',
  },
  {
    value: 'other',
    title: 'Something else',
    description: 'Your goal is unique. We\'ll start conservatively and adapt as we learn more.',
  },
];

export default function GoalSelectionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [selected, setSelected] = useState<RehabGoal | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!selected) {
      setError('Please select a goal to continue.');
      return;
    }
    if (!user) return;

    setIsSubmitting(true);
    setError(null);

    const { error: profileError } = await updateProfile(user.id, {
      rehab_goal: selected,
    });

    if (profileError) {
      setIsSubmitting(false);
      setError('Something went wrong. Please try again.');
      return;
    }

    const { error: stepError } = await updateOnboardingStep(user.id, 'generating');

    setIsSubmitting(false);

    if (stepError) {
      setError('Something went wrong. Please try again.');
      return;
    }

    router.replace('/(onboarding)/plan-generation');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>What's your goal?</Text>
        <Text style={styles.subtitle}>
          This shapes the entire plan — from the exercises we choose to how we measure progress.
          You can update it later.
        </Text>

        <View style={styles.options}>
          {GOAL_OPTIONS.map((option) => {
            const isActive = selected === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => {
                  setSelected(option.value);
                  setError(null);
                }}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={option.title}
                accessibilityHint={option.description}
                style={[styles.card, isActive && styles.cardActive]}
              >
                <View style={styles.cardInner}>
                  <View style={[styles.radio, isActive && styles.radioActive]}>
                    {isActive && <View style={styles.radioDot} />}
                  </View>
                  <View style={styles.cardText}>
                    <Text style={[styles.cardTitle, isActive && styles.cardTitleActive]}>
                      {option.title}
                    </Text>
                    <Text style={styles.cardDescription}>{option.description}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Build my plan"
          onPress={handleContinue}
          loading={isSubmitting}
          disabled={!selected}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg.base,
  } as ViewStyle,

  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.space5,
    paddingTop: Spacing.space10,
    paddingBottom: Spacing.space8,
    gap: Spacing.space6,
  } as ViewStyle,

  title: {
    ...Typography.h1,
    color: Colors.text.primary,
  } as TextStyle,

  subtitle: {
    ...Typography.bodyLarge,
    color: Colors.text.secondary,
    marginTop: -Spacing.space2,
  } as TextStyle,

  options: {
    gap: Spacing.space3,
  } as ViewStyle,

  card: {
    backgroundColor: Colors.bg.surfaceRaised,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border.default,
    padding: Spacing.space5,
    ...Shadows.sm,
  } as ViewStyle,

  cardActive: {
    borderColor: Colors.primary,
  } as ViewStyle,

  cardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.space4,
  } as ViewStyle,

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  } as ViewStyle,

  radioActive: {
    borderColor: Colors.primary,
  } as ViewStyle,

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  } as ViewStyle,

  cardText: {
    flex: 1,
    gap: Spacing.space1,
  } as ViewStyle,

  cardTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  } as TextStyle,

  cardTitleActive: {
    color: Colors.primaryDark,
  } as TextStyle,

  cardDescription: {
    ...Typography.body,
    color: Colors.text.secondary,
  } as TextStyle,

  errorText: {
    ...Typography.bodySmall,
    color: Colors.semantic.danger,
  } as TextStyle,

  footer: {
    paddingHorizontal: Spacing.space5,
    paddingBottom: Spacing.space6,
    paddingTop: Spacing.space4,
  } as ViewStyle,
});
