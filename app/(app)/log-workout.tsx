/**
 * Workout logging screen — reached after tapping "Start workout" on Today.
 *
 * Tracks sets completed per exercise using InProgressRow / TodayStepper.
 * On "Complete Workout" navigates to post-workout-checkin where pain + effort
 * are captured and the log is saved.
 *
 * Expects route params: sessionId, workoutId, exercisesJson (JSON string)
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Typography, Spacing, FontFamily } from '@/theme';
import { Button, InProgressRow, SetsProgressRun } from '@/components/ui';
import { useWorkoutLogging } from '@/hooks/useWorkoutLogging';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LogWorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    sessionId: string;
    workoutId: string;
    exercisesJson: string;
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

  const handleComplete = () => {
    // Serialize actuals to pass to post-workout-checkin
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
          <Text style={styles.eyebrow}>Today's workout</Text>
          <Text style={styles.screenTitle}>In Progress</Text>
        </View>

        {/* Progress strip */}
        {totalSegments > 0 && (
          <View style={styles.progressSection}>
            <SetsProgressRun
              totalSegments={totalSegments}
              completedSegments={completedSegments}
            />
            <Text style={styles.progressLabel}>
              {completedSegments} / {totalSegments} sets
            </Text>
          </View>
        )}

        {/* Exercise rows */}
        <View style={styles.exerciseList}>
          {logging.exerciseActuals.map((ea, i) => (
            <InProgressRow
              key={`${ea.exerciseName}-${i}`}
              name={ea.exerciseName}
              prescribedSets={parsedExercises[i]?.prescribedSets ?? 0}
              prescribedReps={parsedExercises[i]?.prescribedReps ?? null}
              setsCompleted={ea.setsCompleted}
              onSetsChange={(v) =>
                logging.setExerciseActual(i, { ...ea, setsCompleted: v })
              }
            />
          ))}
        </View>

        <Button
          label="Complete workout"
          variant="hero"
          onPress={handleComplete}
          style={styles.completeButton}
        />

        <Button
          label="Cancel"
          variant="secondary"
          onPress={() => router.back()}
          style={styles.cancelButton}
        />
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

  header: {
    paddingTop: Spacing.space4,
    marginBottom: Spacing.space5,
    gap: Spacing.space2,
  } as ViewStyle,

  eyebrow: {
    ...Typography.eyebrow,
    color: Colors.text.muted,
  } as TextStyle,

  screenTitle: {
    fontFamily: FontFamily.black,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.2,
    color: Colors.text.primary,
  } as TextStyle,

  progressSection: {
    gap: Spacing.space2,
    marginBottom: Spacing.space5,
  } as ViewStyle,

  progressLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    color: Colors.text.muted,
    letterSpacing: 0.4,
  } as TextStyle,

  exerciseList: {
    marginBottom: Spacing.space6,
  } as ViewStyle,

  completeButton: {
    marginBottom: Spacing.space3,
  } as ViewStyle,

  cancelButton: {} as ViewStyle,
});
