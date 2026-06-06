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
  tempo?: string | null;
  restSeconds?: number | null;
  notes?: string | null;
  /** When true, removes the bottom divider (last row in list) */
  isLast?: boolean;
}

function formatPrescription(sets: number, reps: string): string {
  const isTime = /\d+\s*(s|sec|seconds?)\b/i.test(reps);
  const repsStr = isTime ? reps.replace(/\s*seconds?\b/gi, 's') : `${reps} reps`;
  return `${sets} × ${repsStr}`;
}

export function PreWorkoutRow({
  index,
  name,
  sets,
  reps,
  load,
  tempo,
  restSeconds,
  notes,
  isLast = false,
}: PreWorkoutRowProps) {
  const parts: string[] = [];
  if (load) parts.push(load);
  if (tempo) parts.push(`TEMPO ${tempo}`);
  if (restSeconds != null) parts.push(`REST ${restSeconds}s`);
  const annotation = parts.join(' · ');

  return (
    <View style={[styles.container, isLast && styles.containerLast]}>
      <Text style={styles.index}>{String(index).padStart(2, '0')}</Text>
      <View style={styles.content}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.prescription}>{formatPrescription(sets, reps)}</Text>
        {annotation.length > 0 && (
          <Text style={styles.annotation}>{annotation}</Text>
        )}
        {notes ? <Text style={styles.notes}>{notes}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.faint,
  } as ViewStyle,

  containerLast: {
    borderBottomWidth: 0,
  } as ViewStyle,

  index: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    lineHeight: 20,
    letterSpacing: 0.44,
    color: Colors.text.muted,
    width: 20,
    textAlign: 'right',
    paddingTop: 2,
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
    letterSpacing: -0.12,
    color: Colors.text.secondary,
  } as TextStyle,

  annotation: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: Colors.text.muted,
    textTransform: 'uppercase',
    marginTop: 2,
  } as TextStyle,

  notes: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    marginTop: 4,
  } as TextStyle,
});
