import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, Typography, FontFamily } from '@/theme';

interface PreWorkoutRowProps {
  /** 1-based display index */
  index: number;
  name: string;
  sets: number;
  reps: string;
  load?: string | null;
  restSeconds?: number | null;
  notes?: string | null;
}

function formatPrescription(sets: number, reps: string): string {
  const isTime = /\d+\s*(s|sec|seconds?)\b/i.test(reps);
  const repsStr = isTime ? reps.replace(/\s*seconds?\b/gi, 's') : `${reps} reps`;
  return `${sets} sets × ${repsStr}`;
}

export function PreWorkoutRow({
  index,
  name,
  sets,
  reps,
  load,
  restSeconds,
  notes,
}: PreWorkoutRowProps) {
  const pills: string[] = [];
  if (load) pills.push(load);
  if (restSeconds != null) pills.push(`${restSeconds}s rest`);

  return (
    <View style={styles.container}>
      <Text style={styles.index}>{index}</Text>
      <View style={styles.content}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.prescription}>{formatPrescription(sets, reps)}</Text>
        {pills.length > 0 && (
          <Text style={styles.meta}>{pills.join('  ·  ')}</Text>
        )}
        {notes ? <Text style={styles.notes}>{notes}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.faint,
  } as ViewStyle,

  index: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    lineHeight: 20,
    color: Colors.text.muted,
    width: 20,
    textAlign: 'right',
  } as TextStyle,

  content: {
    flex: 1,
    gap: 2,
  } as ViewStyle,

  name: {
    ...Typography.h3,
    color: Colors.text.primary,
  } as TextStyle,

  prescription: {
    fontFamily: FontFamily.mono,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.text.secondary,
  } as TextStyle,

  meta: {
    ...Typography.bodySmall,
    color: Colors.text.muted,
    marginTop: 2,
  } as TextStyle,

  notes: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    marginTop: 4,
  } as TextStyle,
});
