/**
 * PostWorkoutCheckIn — sits between log-workout and the Today completed state.
 *
 * Shows a stat summary of what was just completed, then captures:
 *   - Pain during session (0–10)
 *   - Effort / difficulty (0–10)
 *
 * On "Log workout": saves the workout log, marks session complete, triggers
 * plan evolution, and navigates back to Today.
 *
 * Route params: sessionId, workoutId, exerciseActualsJson, exercisesJson,
 *   elapsedSeconds, phaseNumber, phaseName
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Typography, Spacing, FontFamily } from '@/theme';
import { Button, PainScale, PhaseBadge, StatStrip } from '@/components/ui';
import type { StatItem } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { saveWorkoutLog } from '@/services/workouts';
import { updateSession } from '@/services/sessions';
import { createSafetyEvent } from '@/services/safetyEvents';
import { enqueueWorkoutLog } from '@/lib/localDb';
import { notifyPlanChanged } from '@/lib/planEvents';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type ExerciseLogInsert = Database['public']['Tables']['exercise_logs']['Insert'];

// ─── High-pain warning overlay ────────────────────────────────────────────────

function HighPainWarning({
  painLevel,
  onAcknowledge,
  onDismiss,
  loading,
}: {
  painLevel: number;
  onAcknowledge: () => void;
  onDismiss: () => void;
  loading: boolean;
}) {
  return (
    <View style={styles.warningOverlay}>
      <View style={styles.warningCard}>
        <Text style={styles.warningTitle}>Pain level noted</Text>
        <Text style={styles.warningBody}>
          You reported {painLevel}/10 pain during this session. This is above our recommended
          threshold. Please consider resting tomorrow and consulting a healthcare professional
          if pain persists.
        </Text>
        <Text style={styles.warningDisclaimer}>
          One Day Stronger is an educational tool and is not a substitute for professional
          medical care.
        </Text>
        <Button
          label="I understand — log my workout"
          onPress={onAcknowledge}
          loading={loading}
        />
        <Button
          label="Go back and edit"
          variant="secondary"
          onPress={onDismiss}
          style={styles.warningBack}
        />
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PostWorkoutCheckinScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();

  const params = useLocalSearchParams<{
    sessionId: string;
    workoutId: string;
    exerciseActualsJson: string;
    exercisesJson: string;
    elapsedSeconds: string;
    phaseNumber: string;
    phaseName: string;
  }>();

  // Parse exercise actuals (setsCompleted per exercise)
  const exerciseActuals: Array<{
    exerciseId: string | null;
    exerciseName: string;
    setsCompleted: number;
  }> = React.useMemo(() => {
    try {
      return JSON.parse(params.exerciseActualsJson ?? '[]');
    } catch {
      return [];
    }
  }, [params.exerciseActualsJson]);

  // Parse original exercises (for prescribedSets)
  const prescribedExercises: Array<{
    exerciseId: string | null;
    exerciseName: string;
    prescribedSets: number;
    prescribedReps: string | null;
  }> = React.useMemo(() => {
    try {
      return JSON.parse(params.exercisesJson ?? '[]');
    } catch {
      return [];
    }
  }, [params.exercisesJson]);

  const [painDuringSession, setPainDuringSession] = useState(0);
  const [effortRating, setEffortRating] = useState(5);
  const [phase, setPhase] = useState<'form' | 'high_pain_warning' | 'submitting' | 'error'>('form');
  const [error, setError] = useState<string | null>(null);

  // Summary stats
  const exerciseCount = exerciseActuals.filter((ea) => ea.setsCompleted > 0).length;
  const totalSets = exerciseActuals.reduce((sum, ea) => sum + ea.setsCompleted, 0);
  const totalPrescribedSets = prescribedExercises.reduce((sum, ex) => sum + ex.prescribedSets, 0);

  // Duration from elapsed timer (min 1 min)
  const elapsedSeconds = parseInt(params.elapsedSeconds ?? '0', 10);
  const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

  // Phase badge
  const phaseNumber = params.phaseNumber ? parseInt(params.phaseNumber, 10) : null;
  const phaseName = params.phaseName || null;
  const showPhaseBadge = phaseNumber != null && !isNaN(phaseNumber) && phaseName != null;

  const statItems: StatItem[] = [
    { value: exerciseCount, label: 'Exercises' },
    { value: durationMinutes, unit: 'MIN', label: 'Duration' },
    { value: `${totalSets}/${totalPrescribedSets}`, label: 'Sets done' },
  ];

  const doSubmit = useCallback(async () => {
    if (!user) return;
    setPhase('submitting');
    setError(null);

    const exerciseLogInserts: ExerciseLogInsert[] = exerciseActuals.map((ea) => ({
      workout_log_id: '', // filled by saveWorkoutLog
      exercise_id: ea.exerciseId ?? null,
      exercise_name: ea.exerciseName,
      sets_completed: ea.setsCompleted,
      reps_per_set: [],
      weight_per_set: null,
      modifications: null,
    }));

    const sessionId = params.sessionId ?? '';
    const workoutId = params.workoutId ?? '';

    // Offline: queue the log for sync on reconnect
    if (!isOnline) {
      try {
        await enqueueWorkoutLog({
          id: `${sessionId}-${Date.now()}`,
          session_id: sessionId,
          workout_id: workoutId,
          user_id: user.id,
          difficulty_rating: effortRating,
          pain_during_session: painDuringSession,
          session_notes: null,
          exercise_logs_json: JSON.stringify(exerciseLogInserts),
          created_at: new Date().toISOString(),
        });
        notifyPlanChanged();
        router.replace('/(app)/today');
      } catch {
        setError('Could not save your workout log. Please try again when online.');
        setPhase('error');
      }
      return;
    }

    const { logId, error: logError } = await saveWorkoutLog(
      {
        user_id: user.id,
        session_id: sessionId,
        generated_workout_id: workoutId,
        difficulty_rating: effortRating,
        session_notes: null,
        pain_during_session: painDuringSession,
      },
      exerciseLogInserts,
    );

    if (logError) {
      setError('Could not save your workout log. Please try again.');
      setPhase('error');
      return;
    }

    await updateSession(sessionId, { status: 'completed' });
    notifyPlanChanged();

    // Trigger plan evolution fire-and-forget
    supabase.functions.invoke('evolve-plan', {
      body: { sessionId, workoutLogId: logId },
    }).then(() => notifyPlanChanged()).catch(() => {/* silently ignore */});

    router.replace('/(app)/today');
  }, [user, isOnline, params.sessionId, params.workoutId, exerciseActuals, effortRating, painDuringSession, router]);

  const handleSubmit = useCallback(async () => {
    if (painDuringSession > 5) {
      setPhase('high_pain_warning');
      return;
    }
    await doSubmit();
  }, [painDuringSession, doSubmit]);

  const handleAcknowledgeHighPain = useCallback(async () => {
    if (!user) return;
    await createSafetyEvent({
      user_id: user.id,
      session_id: params.sessionId ?? '',
      trigger: 'high_pain_logging',
      pain_level_reported: painDuringSession,
      details: `User reported ${painDuringSession}/10 pain during session.`,
      professional_care_acknowledged: false,
    });
    await doSubmit();
  }, [user, params.sessionId, painDuringSession, doSubmit]);

  const monoDateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).toUpperCase().replace(',', ' ·');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.dateMeta}>{monoDateLabel}</Text>
          <Text style={styles.screenHero}>How did it go?</Text>
          {showPhaseBadge && (
            <View style={styles.phaseBadgeRow}>
              <PhaseBadge phaseNumber={phaseNumber!} phaseName={phaseName!} />
            </View>
          )}
        </View>

        {/* Stat strip */}
        <StatStrip items={statItems} />

        {/* Rate section heading */}
        <View style={styles.rateSection}>
          <Text style={styles.rateSectionTitle}>Rate your session.</Text>
          <Text style={styles.rateSectionSubtext}>This helps calibrate your next workout.</Text>
        </View>

        {/* Pain scale */}
        <PainScale
          value={painDuringSession}
          onValueChange={setPainDuringSession}
          label="PAIN"
          minLabel="0  NO PAIN"
          maxLabel="10  WORST"
        />

        {/* Scale divider */}
        <View style={styles.scaleDivider} />

        {/* Effort scale */}
        <View style={styles.effortWrapper}>
          <PainScale
            value={effortRating}
            onValueChange={setEffortRating}
            label="EFFORT"
            minLabel="0  VERY EASY"
            maxLabel="10  MAXIMAL"
          />
        </View>

        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {/* CTAs */}
        <View style={styles.ctaSection}>
          <Button
            label="Log workout"
            variant="primary"
            arrow="→"
            onPress={handleSubmit}
            loading={phase === 'submitting'}
          />
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>← Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {phase === 'high_pain_warning' && (
        <HighPainWarning
          painLevel={painDuringSession}
          onAcknowledge={handleAcknowledgeHighPain}
          onDismiss={() => setPhase('form')}
          loading={false}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg.base,
  } as ViewStyle,

  scroll: {
    flex: 1,
  } as ViewStyle,

  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing.space8,
  } as ViewStyle,

  // ── Header ────────────────────────────────────────────────────────────────

  header: {
    paddingTop: Spacing.space4,
    gap: Spacing.space2,
    marginBottom: Spacing.space5,
  } as ViewStyle,

  dateMeta: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    color: Colors.text.muted,
    letterSpacing: 0.44,
    textTransform: 'uppercase',
  } as TextStyle,

  screenHero: {
    fontFamily: FontFamily.black,
    fontSize: 40,
    lineHeight: 39,
    letterSpacing: -1.4,
    color: Colors.text.primary,
    marginTop: 12,
  } as TextStyle,

  phaseBadgeRow: {
    marginTop: 10,
  } as ViewStyle,

  // ── Rate section ──────────────────────────────────────────────────────────

  rateSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.strong,
    paddingTop: 14,
    gap: 8,
    marginTop: Spacing.space6,
    marginBottom: 28,
  } as ViewStyle,

  rateSectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.18,
    color: Colors.text.primary,
  } as TextStyle,

  rateSectionSubtext: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.text.secondary,
  } as TextStyle,

  // ── Scales ────────────────────────────────────────────────────────────────

  scaleDivider: {
    height: 1,
    backgroundColor: Colors.border.faint,
    marginVertical: 28,
  } as ViewStyle,

  effortWrapper: {
    marginBottom: Spacing.space8,
  } as ViewStyle,

  // ── CTAs ──────────────────────────────────────────────────────────────────

  ctaSection: {
    gap: 8,
  } as ViewStyle,

  cancelButton: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  cancelText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    letterSpacing: 1.56,
    textTransform: 'uppercase',
    color: Colors.text.muted,
  } as TextStyle,

  errorText: {
    ...Typography.body,
    color: Colors.semantic.danger,
    textAlign: 'center',
    marginBottom: 8,
  } as TextStyle,

  // ── Warning overlay ───────────────────────────────────────────────────────

  warningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.screenHorizontal,
  } as ViewStyle,

  warningCard: {
    backgroundColor: Colors.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border.faint,
    padding: Spacing.space6,
    gap: Spacing.space4,
  } as ViewStyle,

  warningTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
  } as TextStyle,

  warningBody: {
    ...Typography.body,
    color: Colors.text.secondary,
  } as TextStyle,

  warningDisclaimer: {
    ...Typography.bodySmall,
    color: Colors.text.disabled,
    fontStyle: 'italic',
  } as TextStyle,

  warningBack: {
    marginTop: -Spacing.space2,
  } as ViewStyle,
});
