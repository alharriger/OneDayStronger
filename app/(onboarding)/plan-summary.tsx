import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, PhaseBadge, LoadingState } from '@/components/ui';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { getActivePlan, type ActivePlan } from '@/services/plans';

export default function PlanSummaryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getActivePlan(user.id).then((p) => {
      setPlan(p);
      setLoading(false);
    });
  }, [user]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <LoadingState message="Loading your plan..." />
      </SafeAreaView>
    );
  }

  const phases = plan?.plan_phases.sort((a, b) => a.phase_number - b.phase_number) ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <Text style={styles.title}>Your rehab plan</Text>
          {plan?.plain_language_summary && (
            <Text style={styles.summary}>{plan.plain_language_summary}</Text>
          )}
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            This plan is an educational guide, not medical advice. Please consult a
            healthcare professional before starting rehabilitation.
          </Text>
        </View>

        {phases.length > 0 && (
          <View style={styles.phasesSection}>
            <Text style={styles.sectionLabel}>Your phases</Text>
            <View style={styles.phases}>
              {phases.map((phase) => (
                <PhaseCard key={phase.id} phase={phase} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Start my first day"
          onPress={() => router.replace('/(app)/today')}
        />
      </View>
    </SafeAreaView>
  );
}

function PhaseCard({ phase }: { phase: ActivePlan['plan_phases'][number] }) {
  const exerciseCount = phase.phase_exercises.length;

  return (
    <Card variant="standard" style={styles.phaseCard}>
      <View style={styles.phaseHeader}>
        <PhaseBadge phaseNumber={phase.phase_number} phaseName={phase.name} />
        <Text style={styles.phaseDuration}>
          ~{phase.estimated_duration_weeks ?? '?'} weeks
        </Text>
      </View>
      {phase.plain_language_summary && (
        <Text style={styles.phaseDescription}>{phase.plain_language_summary}</Text>
      )}
      <Text style={styles.exerciseCount}>
        {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
      </Text>
    </Card>
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
    gap: Spacing.space8,
  } as ViewStyle,

  heroSection: {
    gap: Spacing.space4,
  } as ViewStyle,

  title: {
    ...Typography.display,
    color: Colors.primaryDark,
  } as TextStyle,

  summary: {
    ...Typography.bodyLarge,
    color: Colors.text.primary,
  } as TextStyle,

  disclaimer: {
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.md,
    padding: Spacing.space4,
  } as ViewStyle,

  disclaimerText: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    textAlign: 'center',
  } as TextStyle,

  phasesSection: {
    gap: Spacing.space4,
  } as ViewStyle,

  sectionLabel: {
    ...Typography.h2,
    color: Colors.text.primary,
  } as TextStyle,

  phases: {
    gap: Spacing.space3,
  } as ViewStyle,

  phaseCard: {
    gap: Spacing.space3,
  } as ViewStyle,

  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,

  phaseDuration: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  } as TextStyle,

  phaseDescription: {
    ...Typography.body,
    color: Colors.text.primary,
  } as TextStyle,

  exerciseCount: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  } as TextStyle,

  footer: {
    paddingHorizontal: Spacing.space5,
    paddingBottom: Spacing.space6,
    paddingTop: Spacing.space4,
  } as ViewStyle,
});
