/**
 * Workout logging screen — reached after completing a workout on Today.
 *
 * Expects route params: sessionId, workoutId, exercisesJson (JSON string)
 * Passes control to useWorkoutLogging hook.
 */
import React from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { Button, PainScale, Card } from '@/components/ui';
import { useWorkoutLogging } from '@/hooks/useWorkoutLogging';

// ─── Exercise log row ─────────────────────────────────────────────────────────

interface ExerciseLogRowProps {
  exerciseName: string;
  prescribedSets: number;
  setsCompleted: number;
  onSetsChange: (v: number) => void;
}

function ExerciseLogRow({
  exerciseName,
  prescribedSets,
  setsCompleted,
  onSetsChange,
}: ExerciseLogRowProps) {
  return (
    <Card style={styles.exerciseCard}>
      <Text style={styles.exerciseName}>{exerciseName}</Text>
      <View style={styles.setsRow}>
        <Text style={styles.setsLabel}>Sets completed</Text>
        <View style={styles.setsCounter}>
          <Text
            style={styles.setsButton}
            onPress={() => onSetsChange(Math.max(0, setsCompleted - 1))}
            accessibilityRole="button"
            accessibilityLabel="Decrease sets"
          >
            −
          </Text>
          <Text style={styles.setsValue}>{setsCompleted}</Text>
          <Text
            style={styles.setsButton}
            onPress={() => onSetsChange(Math.min(20, setsCompleted + 1))}
            accessibilityRole="button"
            accessibilityLabel="Increase sets"
          >
            +
          </Text>
        </View>
        <Text style={styles.prescribed}>of {prescribedSets} prescribed</Text>
      </View>
    </Card>
  );
}

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

  // Navigate away once log is saved
  React.useEffect(() => {
    if (logging.phase === 'success') {
      router.replace('/(app)/today');
    }
  }, [logging.phase, router]);

  if (logging.phase === 'success') return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Log workout</Text>
        </View>

        {/* Exercise actuals */}
        {logging.exerciseActuals.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Exercises</Text>
            {logging.exerciseActuals.map((ea, i) => (
              <ExerciseLogRow
                key={`${ea.exerciseName}-${i}`}
                exerciseName={ea.exerciseName}
                prescribedSets={parsedExercises[i]?.prescribedSets ?? ea.setsCompleted}
                setsCompleted={ea.setsCompleted}
                onSetsChange={(v) =>
                  logging.setExerciseActual(i, { ...ea, setsCompleted: v })
                }
              />
            ))}
          </>
        )}

        {/* Session-level ratings */}
        <Text style={styles.sectionLabel}>How did it feel?</Text>

        <View style={styles.ratingSection}>
          <Text style={styles.ratingLabel}>
            Difficulty ({logging.difficultyRating}/10)
          </Text>
          <PainScale
            value={logging.difficultyRating}
            onValueChange={logging.setDifficultyRating}
            accessibilityLabel="Difficulty rating"
          />
        </View>

        <View style={styles.ratingSection}>
          <Text style={styles.ratingLabel}>
            Pain during session ({logging.painDuringSession}/10)
          </Text>
          <PainScale
            value={logging.painDuringSession}
            onValueChange={logging.setPainDuringSession}
            accessibilityLabel="Pain during session"
          />
          {logging.painDuringSession > 5 && (
            <Text style={styles.painWarningInline}>
              Pain &gt; 5/10 — you'll need to acknowledge a safety reminder before submitting.
            </Text>
          )}
        </View>

        <Text style={styles.sectionLabel}>Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          value={logging.sessionNotes}
          onChangeText={logging.setSessionNotes}
          multiline
          numberOfLines={3}
          placeholder="How did it go? Any modifications?"
          placeholderTextColor={Colors.text.disabled}
        />

        {logging.error && (
          <Text style={styles.errorText}>{logging.error}</Text>
        )}

        <Button
          label="Save workout log"
          onPress={logging.submit}
          loading={logging.phase === 'submitting'}
          style={styles.submitButton}
        />

        <Button
          label="Cancel"
          variant="secondary"
          onPress={() => router.back()}
          style={styles.cancelButton}
        />
      </ScrollView>

      {/* High-pain warning modal (inline alert) */}
      {logging.phase === 'high_pain_warning' && (
        <View style={styles.warningOverlay}>
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Pain level noted</Text>
            <Text style={styles.warningBody}>
              You reported {logging.painDuringSession}/10 pain during this session. This is
              above our recommended threshold. Please consider resting tomorrow and consulting
              a healthcare professional if pain persists.
            </Text>
            <Text style={styles.warningDisclaimer}>
              One Day Stronger is an educational tool and is not a substitute for professional
              medical care.
            </Text>
            <Button
              label="I understand — save my log"
              onPress={logging.acknowledgeHighPain}
              loading={logging.phase === 'submitting'}
            />
            <Button
              label="Go back and edit"
              variant="secondary"
              onPress={logging.dismissHighPain}
              style={styles.warningBack}
            />
          </View>
        </View>
      )}
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
  sectionLabel: {
    ...Typography.h2,
    color: Colors.text.primary,
    marginTop: Spacing.space5,
    marginBottom: Spacing.space3,
  } as TextStyle,
  exerciseCard: { marginBottom: Spacing.space3 } as ViewStyle,
  exerciseName: { ...Typography.h3, color: Colors.text.primary, marginBottom: Spacing.space2 } as TextStyle,
  setsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.space3,
  } as ViewStyle,
  setsLabel: { ...Typography.label, color: Colors.text.secondary, flex: 1 } as TextStyle,
  setsCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.space3,
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.space3,
    paddingVertical: Spacing.space2,
  } as ViewStyle,
  setsButton: {
    ...Typography.h2,
    color: Colors.primary,
    minWidth: 24,
    textAlign: 'center',
  } as TextStyle,
  setsValue: {
    ...Typography.h3,
    color: Colors.text.primary,
    minWidth: 28,
    textAlign: 'center',
  } as TextStyle,
  prescribed: { ...Typography.bodySmall, color: Colors.text.disabled } as TextStyle,
  ratingSection: { gap: Spacing.space2, marginBottom: Spacing.space4 } as ViewStyle,
  ratingLabel: { ...Typography.label, color: Colors.text.secondary } as TextStyle,
  painWarningInline: {
    ...Typography.bodySmall,
    color: Colors.semantic.warning,
    marginTop: Spacing.space1,
  } as TextStyle,
  notesInput: {
    ...Typography.body,
    color: Colors.text.primary,
    backgroundColor: Colors.bg.surfaceRaised,
    borderRadius: Radius.md,
    padding: Spacing.space3,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: Spacing.space2,
  } as TextStyle,
  errorText: {
    ...Typography.body,
    color: Colors.semantic.danger,
    textAlign: 'center',
    marginBottom: Spacing.space3,
  } as TextStyle,
  submitButton: { marginTop: Spacing.space2 } as ViewStyle,
  cancelButton: { marginTop: Spacing.space2 } as ViewStyle,
  // Warning overlay
  warningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.screenHorizontal,
  } as ViewStyle,
  warningCard: {
    backgroundColor: Colors.bg.surfaceRaised,
    borderRadius: Radius.xl ?? Radius.lg,
    padding: Spacing.space6,
    gap: Spacing.space4,
  } as ViewStyle,
  warningTitle: { ...Typography.h2, color: Colors.text.primary } as TextStyle,
  warningBody: { ...Typography.body, color: Colors.text.secondary } as TextStyle,
  warningDisclaimer: {
    ...Typography.bodySmall,
    color: Colors.text.disabled,
    fontStyle: 'italic',
  } as TextStyle,
  warningBack: { marginTop: -Spacing.space2 } as ViewStyle,
});
