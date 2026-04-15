import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { Colors, Typography, Spacing } from '@/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { updateOnboardingStep } from '@/services/profiles';

type GenerationStatus = 'generating' | 'success' | 'error';

const STATUS_MESSAGES = [
  'Reading your intake...',
  'Reviewing PHT research...',
  'Selecting exercises for your phase...',
  'Calibrating progression criteria...',
  'Finalising your plan...',
];

export default function PlanGenerationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [status, setStatus] = useState<GenerationStatus>('generating');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Cycle through status messages while generating
  useEffect(() => {
    if (status !== 'generating') return;

    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      setMessageIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 2200);

    return () => clearInterval(interval);
  }, [status, fadeAnim]);

  // Trigger plan generation on mount
  useEffect(() => {
    if (!user) return;
    generatePlan();
  }, [user]);

  async function generatePlan() {
    setStatus('generating');
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-plan', {
        body: { user_id: user!.id },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.planId) {
        throw new Error(data?.error ?? 'Plan generation failed.');
      }

      setStatus('success');

      // Brief pause so the user sees success state, then advance
      setTimeout(() => {
        router.replace('/(onboarding)/plan-summary');
      }, 800);
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong generating your plan.'
      );
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {status === 'generating' && (
          <View style={styles.center}>
            <ActivityIndicator
              size="large"
              color={Colors.primary}
              style={styles.spinner}
            />
            <Text style={styles.headline}>Building your plan</Text>
            <Animated.Text style={[styles.statusMessage, { opacity: fadeAnim }]}>
              {STATUS_MESSAGES[messageIndex]}
            </Animated.Text>
            <Text style={styles.hint}>
              This usually takes about 15–30 seconds.
            </Text>
          </View>
        )}

        {status === 'success' && (
          <View style={styles.center}>
            <Text style={styles.successEmoji} accessibilityLabel="Plan ready">
              {'\u2705'}
            </Text>
            <Text style={styles.headline}>Your plan is ready</Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.center}>
            <Text style={styles.headline}>Let's try that again</Text>
            <Text style={styles.errorBody}>
              {errorMessage ??
                'We couldn\'t generate your plan right now. Please try again.'}
            </Text>
            <Button
              label="Try again"
              onPress={generatePlan}
              style={styles.retryButton}
            />
          </View>
        )}
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.space5,
  } as ViewStyle,

  center: {
    alignItems: 'center',
    gap: Spacing.space4,
    maxWidth: 320,
  } as ViewStyle,

  spinner: {
    marginBottom: Spacing.space4,
  } as ViewStyle,

  headline: {
    ...Typography.h1,
    color: Colors.text.primary,
    textAlign: 'center',
  } as TextStyle,

  statusMessage: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  } as TextStyle,

  hint: {
    ...Typography.bodySmall,
    color: Colors.text.disabled,
    textAlign: 'center',
  } as TextStyle,

  successEmoji: {
    fontSize: 48,
    lineHeight: 56,
  } as TextStyle,

  errorBody: {
    ...Typography.bodyLarge,
    color: Colors.text.secondary,
    textAlign: 'center',
  } as TextStyle,

  retryButton: {
    marginTop: Spacing.space2,
    minWidth: 200,
  } as ViewStyle,
});
