import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing } from '@/theme';
import {
  Button,
  PainScale,
  ExerciseCard,
  LoadingState,
  SafetyAdvisoryModal,
  EvolutionEventBanner,
} from '@/components/ui';
import { useTodayWorkout } from '@/hooks/useTodayWorkout';
import { useAuth } from '@/hooks/useAuth';
import { acknowledgeSafetyEvent } from '@/services/safetyEvents';
import { getUnseenEvents, markEventSeen } from '@/services/evolution';

// ─── Check-in widget ──────────────────────────────────────────────────────────

interface CheckInWidgetProps {
  onSubmit: (pain: number, soreness: number) => void;
}

function CheckInWidget({ onSubmit }: CheckInWidgetProps) {
  const [pain, setPain] = useState(0);
  const [soreness, setSoreness] = useState(0);

  return (
    <View style={styles.checkInContainer}>
      <Text style={styles.sectionTitle}>How are you feeling today?</Text>
      <Text style={styles.sectionSubtitle}>
        Rate your pain and soreness at the hamstring attachment site.
      </Text>

      <View style={styles.scaleRow}>
        <Text style={styles.scaleLabel}>Pain</Text>
        <PainScale
          value={pain}
          onValueChange={setPain}
          accessibilityLabel="Pain level"
        />
      </View>

      <View style={styles.scaleRow}>
        <Text style={styles.scaleLabel}>Soreness</Text>
        <PainScale
          value={soreness}
          onValueChange={setSoreness}
          accessibilityLabel="Soreness level"
        />
      </View>

      <Button
        label="Generate my workout"
        onPress={() => onSubmit(pain, soreness)}
        style={styles.checkInButton}
      />
    </View>
  );
}

// ─── Rest day card ────────────────────────────────────────────────────────────

interface RestDayCardProps {
  explanation: string;
}

function RestDayCard({ explanation }: RestDayCardProps) {
  return (
    <View style={styles.restCard}>
      <Text style={styles.restTitle}>Rest day recommended</Text>
      <Text style={styles.restBody}>{explanation}</Text>
    </View>
  );
}

// ─── Workout display ──────────────────────────────────────────────────────────

interface WorkoutDisplayProps {
  workoutType: 'standard' | 'modified' | 'rest_recommendation';
  explanation: string;
  exercises: Array<{
    exercise_name: string;
    sets: number;
    reps: string;
    load: string;
    tempo: string;
    rest_seconds: number;
    notes: string;
  }>;
  fallbackBanner?: string;
  onStartWorkout: () => void;
}

function WorkoutDisplay({
  workoutType,
  explanation,
  exercises,
  fallbackBanner,
  onStartWorkout,
}: WorkoutDisplayProps) {
  return (
    <View style={styles.workoutContainer}>
      {fallbackBanner && (
        <View style={styles.fallbackBanner}>
          <Text style={styles.fallbackBannerText}>{fallbackBanner}</Text>
        </View>
      )}

      {workoutType === 'modified' && (
        <View style={styles.modifiedBadge}>
          <Text style={styles.modifiedBadgeText}>Modified workout</Text>
        </View>
      )}

      <Text style={styles.explanationText}>{explanation}</Text>

      {exercises.map((ex, i) => (
        <ExerciseCard
          key={`${ex.exercise_name}-${i}`}
          exercise={{
            name: ex.exercise_name,
            sets: ex.sets,
            reps: ex.reps,
            load: ex.load,
            tempo: ex.tempo,
            restSeconds: ex.rest_seconds,
            notes: ex.notes || null,
            videoUrl: null,
          }}
        />
      ))}

      <Button
        label="Start workout"
        onPress={onStartWorkout}
        style={styles.startButton}
      />
    </View>
  );
}

// ─── Today screen ─────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const today = useTodayWorkout();
  const [showingSafety, setShowingSafety] = useState(false);
  const [evolutionBanner, setEvolutionBanner] = useState<{
    eventType: 'progression' | 'regression' | 'hold';
    rationale: string;
    eventId: string;
  } | null>(null);

  // Show safety modal when the phase transitions to safety_advisory
  React.useEffect(() => {
    if (today.phase === 'safety_advisory') {
      setShowingSafety(true);
    }
  }, [today.phase]);

  // Load unseen evolution events once workout is ready
  React.useEffect(() => {
    if (!user || today.phase !== 'workout_ready') return;
    getUnseenEvents(user.id).then((events) => {
      if (events.length > 0) {
        const latest = events[0];
        setEvolutionBanner({
          eventType: latest.event_type as 'progression' | 'regression' | 'hold',
          rationale: latest.rationale,
          eventId: latest.id,
        });
      }
    });
  }, [user, today.phase]);

  const handleAcknowledgeSafety = async () => {
    if (today.safetyEventId && user) {
      await acknowledgeSafetyEvent(today.safetyEventId);
    }
    setShowingSafety(false);
    today.acknowledgeSafety();
  };

  const handleDismissEvolution = async () => {
    if (evolutionBanner && user) {
      await markEventSeen(evolutionBanner.eventId);
    }
    setEvolutionBanner(null);
  };

  const renderContent = () => {
    switch (today.phase) {
      case 'loading':
        return <LoadingState message="Loading your day..." />;

      case 'check_in':
        return <CheckInWidget onSubmit={today.submitCheckIn} />;

      case 'generating':
        return <LoadingState message="Generating your workout…" />;

      case 'workout_ready':
        if (!today.workout) return null;
        return (
          <WorkoutDisplay
            workoutType={today.workout.workout_type}
            explanation={today.workout.plain_language_explanation}
            exercises={today.workout.exercises}
            fallbackBanner={today.workout.fallbackBanner}
            onStartWorkout={() => {
              if (!today.workout || !today.sessionId) return;
              const exercises = today.workout.exercises.map((e) => ({
                exerciseId: null,
                exerciseName: e.exercise_name,
                prescribedSets: e.sets,
              }));
              router.push({
                pathname: '/(app)/log-workout',
                params: {
                  sessionId: today.sessionId,
                  workoutId: today.workout.workoutId,
                  exercisesJson: JSON.stringify(exercises),
                },
              });
            }}
          />
        );

      case 'rest_day':
        return (
          <RestDayCard
            explanation={
              today.workout?.plain_language_explanation ??
              'Rest today to let your tendon recover.'
            }
          />
        );

      case 'safety_advisory':
        // Rendered via modal; show a placeholder while it loads
        return <LoadingState message="Loading safety advisory…" />;

      case 'error':
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{today.error}</Text>
            {today.isRetryable && (
              <Button
                label="Try again"
                variant="secondary"
                onPress={today.retryWorkoutGeneration}
                style={styles.retryButton}
              />
            )}
          </View>
        );
    }
  };

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {evolutionBanner && (
          <EvolutionEventBanner
            eventType={evolutionBanner.eventType}
            title={
              evolutionBanner.eventType === 'progression'
                ? "You've advanced to the next phase!"
                : evolutionBanner.eventType === 'regression'
                ? "Plan adjusted based on your recent sessions"
                : "Holding your current phase"
            }
            rationale={evolutionBanner.rationale}
            onDismiss={handleDismissEvolution}
          />
        )}

        <View style={styles.header}>
          <Text style={styles.dateLabel}>{todayLabel}</Text>
          <Text style={styles.screenTitle}>Today</Text>
        </View>

        {renderContent()}
      </ScrollView>

      {showingSafety && today.safetyDetails && (
        <SafetyAdvisoryModal
          visible={showingSafety}
          details={today.safetyDetails}
          onAcknowledge={handleAcknowledgeSafety}
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

  header: {
    paddingTop: Spacing.space4,
    marginBottom: Spacing.space5,
  } as ViewStyle,

  dateLabel: {
    ...Typography.label,
    color: Colors.text.secondary,
    marginBottom: Spacing.space1,
  } as TextStyle,

  screenTitle: {
    ...Typography.h1,
    color: Colors.text.primary,
  } as TextStyle,

  // Check-in
  checkInContainer: {
    gap: Spacing.space4,
  } as ViewStyle,

  sectionTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
  } as TextStyle,

  sectionSubtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginTop: -Spacing.space2,
  } as TextStyle,

  scaleRow: {
    gap: Spacing.space2,
  } as ViewStyle,

  scaleLabel: {
    ...Typography.label,
    color: Colors.text.secondary,
  } as TextStyle,

  checkInButton: {
    marginTop: Spacing.space2,
  } as ViewStyle,

  // Rest day
  restCard: {
    backgroundColor: Colors.bg.surfaceRaised,
    borderRadius: 12,
    padding: Spacing.space5,
    gap: Spacing.space3,
    borderLeftWidth: 4,
    borderLeftColor: Colors.semantic.warning,
  } as ViewStyle,

  restTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  } as TextStyle,

  restBody: {
    ...Typography.body,
    color: Colors.text.secondary,
  } as TextStyle,

  // Workout
  workoutContainer: {
    gap: Spacing.space4,
  } as ViewStyle,

  fallbackBanner: {
    backgroundColor: Colors.semantic.warning + '22',
    borderRadius: 8,
    padding: Spacing.space3,
    borderLeftWidth: 3,
    borderLeftColor: Colors.semantic.warning,
  } as ViewStyle,

  fallbackBannerText: {
    ...Typography.bodySmall,
    color: Colors.semantic.warning,
  } as TextStyle,

  modifiedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.semantic.warning + '22',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: Spacing.space3,
  } as ViewStyle,

  modifiedBadgeText: {
    ...Typography.label,
    color: Colors.semantic.warning,
  } as TextStyle,

  explanationText: {
    ...Typography.body,
    color: Colors.text.secondary,
  } as TextStyle,

  startButton: {
    marginTop: Spacing.space2,
  } as ViewStyle,

  // Error
  errorContainer: {
    gap: Spacing.space4,
    alignItems: 'center',
    paddingTop: Spacing.space6,
  } as ViewStyle,

  errorText: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  } as TextStyle,

  retryButton: {
    minWidth: 160,
  } as ViewStyle,
});
