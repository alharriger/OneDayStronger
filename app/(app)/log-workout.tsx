/**
 * Workout logging screen — reached after tapping "Start workout" on Today.
 *
 * Tracks sets completed per exercise using InProgressRow / TodayStepper.
 * On "Complete Workout" navigates to post-workout-checkin where pain + effort
 * are captured and the log is saved.
 *
 * Expects route params: sessionId, workoutId, exercisesJson (JSON string),
 *   phaseNumber (string), phaseName (string)
 */
import React, { useEffect, useRef, useState } from 'react';
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
import { Button, InProgressRow, SetsProgressRun, PhaseBadge } from '@/components/ui';
import { useWorkoutLogging } from '@/hooks/useWorkoutLogging';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LogWorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    sessionId: string;
    workoutId: string;
    exercisesJson: string;
    phaseNumber: string;
    phaseName: string;
  }>();

  const parsedExercises: Array<{
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

  const phaseNumber = params.phaseNumber ? parseInt(params.phaseNumber, 10) : null;
  const phaseName = params.phaseName || null;
  const showPhaseBadge = phaseNumber != null && !isNaN(phaseNumber) && phaseName != null;

  // Elapsed workout timer (counts up from screen mount)
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  const timerLabel = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  const logging = useWorkoutLogging({
    sessionId: params.sessionId ?? '',
    workoutId: params.workoutId ?? '',
    exercises: parsedExercises,
  });

  // Progress calculation
  const totalSegments = parsedExercises.reduce((sum, ex) => sum + ex.prescribedSets, 0);
  const completedSegments = logging.exerciseActuals.reduce(
    (sum, ea, i) => sum + Math.min(ea.setsCompleted, parsedExercises[i]?.prescribedSets ?? 0),
    0
  );
  const allDone = totalSegments > 0 && completedSegments >= totalSegments;
  const canComplete = completedSegments > 0;

  const monoDateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).toUpperCase().replace(',', ' ·');

  const handleComplete = () => {
    const actualsForCheckin = logging.exerciseActuals.map((ea) => ({
      exerciseId: ea.exerciseId,
      exerciseName: ea.exerciseName,
      setsCompleted: ea.setsCompleted,
    }));
    router.push({
      pathname: '/(app)/post-workout-checkin',
      params: {
        sessionId: params.sessionId ?? '',
        workoutId: params.workoutId ?? '',
        exerciseActualsJson: JSON.stringify(actualsForCheckin),
        exercisesJson: params.exercisesJson ?? '[]',
        elapsedSeconds: String(elapsed),
        phaseNumber: params.phaseNumber ?? '',
        phaseName: params.phaseName ?? '',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          {/* Row 1: date + timer */}
          <View style={styles.headerTopRow}>
            <Text style={styles.dateMeta}>{monoDateLabel}</Text>
            <Text style={styles.timer}>{timerLabel}</Text>
          </View>

          {/* Hero title */}
          <Text style={styles.screenHero}>
            {allDone ? 'Done.' : 'In progress.'}
          </Text>

          {/* Phase badge */}
          {showPhaseBadge && (
            <View style={styles.phaseBadgeRow}>
              <PhaseBadge
                phaseNumber={phaseNumber!}
                phaseName={phaseName!}
              />
            </View>
          )}
        </View>

        {/* Sets progress run */}
        {totalSegments > 0 && (
          <View style={styles.progressSection}>
            <SetsProgressRun
              totalSegments={totalSegments}
              completedSegments={completedSegments}
            />
          </View>
        )}

        {/* Exercise section */}
        <View style={styles.exerciseSection}>
          <View style={styles.exerciseSectionHeader}>
            <Text style={styles.exerciseSectionEyebrow}>Today's workout</Text>
            <Text style={styles.exerciseCount}>
              {parsedExercises.length} exercises
            </Text>
          </View>
          <View style={styles.exerciseSectionDivider} />
          <View style={styles.exerciseList}>
            {logging.exerciseActuals.map((ea, i) => (
              <InProgressRow
                key={`${ea.exerciseName}-${i}`}
                index={i + 1}
                name={ea.exerciseName}
                prescribedSets={parsedExercises[i]?.prescribedSets ?? 0}
                prescribedReps={parsedExercises[i]?.prescribedReps ?? null}
                setsCompleted={ea.setsCompleted}
                isLast={i === logging.exerciseActuals.length - 1}
                onSetsChange={(v) =>
                  logging.setExerciseActual(i, { ...ea, setsCompleted: v })
                }
              />
            ))}
          </View>
        </View>

        {/* CTAs */}
        <View style={styles.ctaSection}>
          <Button
            label="Complete workout"
            variant="primary"
            arrow="→"
            disabled={!canComplete}
            onPress={handleComplete}
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
    </SafeAreaView>
  );
}

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
    marginBottom: Spacing.space5,
    gap: Spacing.space2,
  } as ViewStyle,

  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,

  dateMeta: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    color: Colors.text.muted,
    letterSpacing: 0.44,
    textTransform: 'uppercase',
  } as TextStyle,

  timer: {
    fontFamily: FontFamily.monoMd,
    fontSize: 12,
    color: Colors.primary,
    letterSpacing: 0.44,
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

  // ── Progress ──────────────────────────────────────────────────────────────

  progressSection: {
    marginBottom: Spacing.space5,
  } as ViewStyle,

  // ── Exercise section ──────────────────────────────────────────────────────

  exerciseSection: {
    marginBottom: 24,
  } as ViewStyle,

  exerciseSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingBottom: 8,
  } as ViewStyle,

  exerciseSectionEyebrow: {
    ...Typography.eyebrow,
    color: Colors.text.primary,
  } as TextStyle,

  exerciseCount: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    color: Colors.text.muted,
    letterSpacing: 0.44,
  } as TextStyle,

  exerciseSectionDivider: {
    height: 1,
    backgroundColor: Colors.border.strong,
    marginBottom: 0,
  } as ViewStyle,

  exerciseList: {
    // rows have their own bottom borders
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
});
