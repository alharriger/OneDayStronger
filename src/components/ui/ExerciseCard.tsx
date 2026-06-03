import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { PlayCircle } from 'phosphor-react-native';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { Card } from './Card';

export interface ExerciseDisplayData {
  name: string;
  sets: number | null;
  reps: string | null;
  load: string | null;
  tempo: string | null;
  restSeconds: number | null;
  notes: string | null;
  videoUrl: string | null;
}

interface ExerciseCardProps {
  exercise: ExerciseDisplayData;
  onVideoPress?: (url: string) => void;
}

/** Format a reps value without adding "reps" when it's already time-based. */
function formatReps(reps: string | null): string | null {
  if (!reps) return null;
  // Time-based (e.g. "45s", "45 seconds", "45 sec") — show as-is, normalised
  if (/\d+\s*(s|sec|seconds?)\b/i.test(reps)) {
    return reps.replace(/\s*seconds?\b/gi, 's');
  }
  return `${reps} reps`;
}

export function ExerciseCard({ exercise, onVideoPress }: ExerciseCardProps) {
  const chips: { label: string; value: string }[] = [];
  if (exercise.load) chips.push({ label: 'Load', value: exercise.load });
  if (exercise.tempo) chips.push({ label: 'Tempo', value: exercise.tempo });
  if (exercise.restSeconds != null)
    chips.push({ label: 'Rest', value: `${exercise.restSeconds}s` });

  const prescription = [
    exercise.sets != null ? `${exercise.sets} sets` : null,
    formatReps(exercise.reps),
  ]
    .filter(Boolean)
    .join(' × ');

  return (
    <Card>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.name}>{exercise.name}</Text>
        {prescription ? (
          <Text style={styles.prescription}>{prescription}</Text>
        ) : null}
      </View>

      {/* Detail chips */}
      {chips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          {chips.map((chip) => (
            <View key={chip.label} style={styles.chip}>
              <Text style={styles.chipLabel}>{chip.label}</Text>
              <Text style={styles.chipText}>{chip.value}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Video link */}
      {exercise.videoUrl && onVideoPress && (
        <TouchableOpacity
          style={styles.videoRow}
          onPress={() => onVideoPress(exercise.videoUrl!)}
          accessibilityRole="button"
          accessibilityLabel={`Watch demo for ${exercise.name}`}
        >
          <PlayCircle size={16} color={Colors.primary} />
          <Text style={styles.videoLabel}>Watch demo</Text>
        </TouchableOpacity>
      )}

      {/* Notes */}
      {exercise.notes && (
        <Text style={styles.notes}>{exercise.notes}</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.space1,
    marginBottom: Spacing.space2,
  } as ViewStyle,

  name: {
    ...Typography.h3,
    color: Colors.text.primary,
  } as TextStyle,

  prescription: {
    ...Typography.body,
    color: Colors.text.secondary,
  } as TextStyle,

  chipsScroll: {
    marginBottom: Spacing.space2,
  } as ViewStyle,

  chipsRow: {
    gap: Spacing.space2,
    flexDirection: 'row',
  } as ViewStyle,

  chip: {
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.chip,
    paddingVertical: Spacing.space1,
    paddingHorizontal: Spacing.space2,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  } as ViewStyle,

  chipLabel: {
    ...Typography.bodySmall,
    color: Colors.text.muted,
  } as TextStyle,

  chipText: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  } as TextStyle,

  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.space1,
    marginBottom: Spacing.space2,
    minHeight: 44,
  } as ViewStyle,

  videoLabel: {
    ...Typography.label,
    color: Colors.primary,
  } as TextStyle,

  notes: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    marginTop: Spacing.space1,
  } as TextStyle,
});
