import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, Typography, FontFamily } from '@/theme';
import { TodayStepper } from './TodayStepper';

interface InProgressRowProps {
  name: string;
  prescribedSets: number;
  prescribedReps: string | null;
  setsCompleted: number;
  onSetsChange: (v: number) => void;
}

function formatPrescription(sets: number, reps: string | null): string {
  if (!reps) return `${sets} sets`;
  const isTime = /\d+\s*(s|sec|seconds?)\b/i.test(reps);
  const repsStr = isTime ? reps.replace(/\s*seconds?\b/gi, 's') : `${reps} reps`;
  return `${sets} sets × ${repsStr}`;
}

export function InProgressRow({
  name,
  prescribedSets,
  prescribedReps,
  setsCompleted,
  onSetsChange,
}: InProgressRowProps) {
  const isDone = setsCompleted >= prescribedSets;

  return (
    <View style={[styles.container, isDone && styles.containerDone]}>
      {/* Col 1: 20px — completion indicator */}
      <View style={[styles.checkBox, isDone && styles.checkBoxDone]} />

      {/* Col 2: 1fr — name + prescription */}
      <View style={styles.meta}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.prescription}>
          {formatPrescription(prescribedSets, prescribedReps)}
        </Text>
      </View>

      {/* Col 3: auto — stepper */}
      <TodayStepper
        value={setsCompleted}
        onDecrement={() => onSetsChange(Math.max(0, setsCompleted - 1))}
        onIncrement={() => onSetsChange(Math.min(prescribedSets + 5, setsCompleted + 1))}
        max={prescribedSets + 5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.faint,
    gap: 12,
  } as ViewStyle,

  containerDone: {
    opacity: 0.5,
  } as ViewStyle,

  checkBox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
  } as ViewStyle,

  checkBoxDone: {
    backgroundColor: Colors.moss,
    borderColor: Colors.moss,
  } as ViewStyle,

  meta: {
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
});
