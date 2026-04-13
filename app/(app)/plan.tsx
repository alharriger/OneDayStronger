import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { PhaseBadge, Card, ExerciseCard } from '@/components/ui';
import { getActivePlan, type ActivePlan, type PlanPhaseWithExercises } from '@/services/plans';
import { useAuth } from '@/hooks/useAuth';

// ─── Phase section ────────────────────────────────────────────────────────────

interface PhaseSectionProps {
  phase: PlanPhaseWithExercises;
  isActive: boolean;
}

function PhaseSection({ phase, isActive }: PhaseSectionProps) {
  const statusLabel =
    phase.status === 'completed'
      ? 'Completed'
      : phase.status === 'active'
      ? 'Current phase'
      : phase.status === 'regressed_from'
      ? 'Regressed from'
      : 'Upcoming';

  const statusColor =
    phase.status === 'completed'
      ? Colors.semantic.success
      : phase.status === 'active'
      ? Colors.primary
      : phase.status === 'regressed_from'
      ? Colors.semantic.danger
      : Colors.text.disabled;

  const criteria = phase.progression_criteria as Record<string, number> | null;

  return (
    <View style={[styles.phaseSection, isActive && styles.phaseSectionActive]}>
      <View style={styles.phaseHeader}>
        <PhaseBadge
          phaseNumber={phase.phase_number}
          phaseName={phase.name}
          isRegressed={phase.status === 'regressed_from'}
        />
        <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
      </View>

      <Text style={styles.phaseDescription}>{phase.plain_language_summary}</Text>

      <View style={styles.criteriaRow}>
        <View style={styles.criteriaItem}>
          <Text style={styles.criteriaValue}>{criteria?.pain_threshold ?? '—'}/10</Text>
          <Text style={styles.criteriaLabel}>Max pain</Text>
        </View>
        <View style={styles.criteriaItem}>
          <Text style={styles.criteriaValue}>{phase.estimated_duration_weeks}w</Text>
          <Text style={styles.criteriaLabel}>Est. duration</Text>
        </View>
        <View style={styles.criteriaItem}>
          <Text style={styles.criteriaValue}>{criteria?.consistency_pct ?? '—'}%</Text>
          <Text style={styles.criteriaLabel}>Consistency</Text>
        </View>
      </View>

      {isActive && phase.phase_exercises.length > 0 && (
        <View style={styles.exercisesSection}>
          <Text style={styles.exercisesTitle}>Phase exercises</Text>
          {phase.phase_exercises.map((pe, i) => (
            <ExerciseCard
              key={pe.id ?? i}
              exercise={{
                name: pe.exercises?.name ?? 'Exercise',
                sets: pe.prescribed_sets,
                reps: pe.prescribed_reps,
                load: pe.load_target,
                tempo: pe.tempo,
                restSeconds: pe.rest_seconds,
                notes: pe.notes ?? null,
                videoUrl: pe.exercises?.video_url ?? null,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Plan screen ──────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getActivePlan(user.id)
      .then((p) => {
        setPlan(p);
        if (!p) setError('No active plan found.');
      })
      .catch(() => setError('Could not load your plan.'))
      .finally(() => setLoading(false));
  }, [user]);

  const sortedPhases = plan?.plan_phases
    ? [...plan.plan_phases].sort((a, b) => a.phase_number - b.phase_number)
    : [];
  const activePhase = sortedPhases.find((p) => p.status === 'active');
  const totalWeeks = sortedPhases.reduce((s, p) => s + (p.estimated_duration_weeks ?? 0), 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Your Plan</Text>
        </View>

        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        )}

        {!loading && error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {!loading && plan && (
          <>
            <Card style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Plan overview</Text>
              <Text style={styles.summaryText}>{plan.plain_language_summary}</Text>
              <View style={styles.planMeta}>
                <Text style={styles.metaLabel}>
                  {sortedPhases.length} phases · {totalWeeks} weeks total
                </Text>
                {activePhase && (
                  <PhaseBadge
                    phaseNumber={activePhase.phase_number}
                    phaseName={activePhase.name}
                  />
                )}
              </View>
            </Card>

            <Text style={styles.sectionHeading}>Phases</Text>

            {sortedPhases.map((phase) => (
              <PhaseSection
                key={phase.id}
                phase={phase}
                isActive={phase.status === 'active'}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bg.base } as ViewStyle,
  scroll: { flex: 1 } as ViewStyle,
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing.space8,
  } as ViewStyle,
  header: { paddingTop: Spacing.space4, marginBottom: Spacing.space5 } as ViewStyle,
  screenTitle: { ...Typography.h1, color: Colors.text.primary } as TextStyle,
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.space8,
  } as ViewStyle,
  errorText: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.space6,
  } as TextStyle,
  summaryCard: { marginBottom: Spacing.space5 } as ViewStyle,
  summaryTitle: {
    ...Typography.label,
    color: Colors.text.secondary,
    marginBottom: Spacing.space2,
  } as TextStyle,
  summaryText: {
    ...Typography.body,
    color: Colors.text.primary,
    marginBottom: Spacing.space4,
  } as TextStyle,
  planMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.space2,
  } as ViewStyle,
  metaLabel: { ...Typography.bodySmall, color: Colors.text.secondary } as TextStyle,
  sectionHeading: {
    ...Typography.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.space4,
  } as TextStyle,
  phaseSection: {
    backgroundColor: Colors.bg.surfaceRaised,
    borderRadius: Radius.lg,
    padding: Spacing.space4,
    marginBottom: Spacing.space4,
    gap: Spacing.space3,
  } as ViewStyle,
  phaseSectionActive: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
  } as ViewStyle,
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.space2,
  } as ViewStyle,
  statusLabel: { ...Typography.label } as TextStyle,
  phaseDescription: { ...Typography.body, color: Colors.text.secondary } as TextStyle,
  criteriaRow: { flexDirection: 'row', gap: Spacing.space4 } as ViewStyle,
  criteriaItem: { alignItems: 'center', gap: 2 } as ViewStyle,
  criteriaValue: { ...Typography.h3, color: Colors.text.primary } as TextStyle,
  criteriaLabel: { ...Typography.label, color: Colors.text.secondary } as TextStyle,
  exercisesSection: { gap: Spacing.space3, marginTop: Spacing.space2 } as ViewStyle,
  exercisesTitle: { ...Typography.label, color: Colors.text.secondary } as TextStyle,
});
