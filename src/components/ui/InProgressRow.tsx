import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Check } from 'phosphor-react-native';
import { Colors, Typography, FontFamily } from '@/theme';
import { TodayStepper } from './TodayStepper';

interface InProgressRowProps {
  /** 1-based display index */
  index: number;
  name: string;
  prescribedSets: number;
  prescribedReps: string | null;
  setsCompleted: number;
  onSetsChange: (v: number) => void;
  /** When true, removes the bottom divider */
  isLast?: boolean;
}

function formatPrescription(sets: number, reps: string | null): string {
  if (!reps) return `${sets} sets`;
  const isTime = /\d+\s*(s|sec|seconds?)\b/i.test(reps);
  const repsStr = isTime ? reps.replace(/\s*seconds?\b/gi, 's') : reps;
  return `${sets} × ${repsStr}`;
}

export function InProgressRow({
  index,
  name,
  prescribedSets,
  prescribedReps,
  setsCompleted,
  onSetsChange,
  isLast = false,
}: InProgressRowProps) {
  const isDone = setsCompleted >= prescribedSets;

  return (
    <View style={[styles.container, isLast && styles.containerLast, isDone && styles.containerDone]}>
      {/* Col 1: 20px — index or moss check */}
      <View style={styles.indicator}>
        {isDone ? (
          <View style={styles.checkSquare}>
            <Check size={10} color={Colors.text.onDark} weight="bold" />
          </View>
        ) : (
          <Text style={styles.index}>{String(index).padStart(2, '0')}</Text>
        )}
      </View>

      {/* Col 2: 1fr — name + prescription */}
      <View style={styles.meta}>
        <Text style={[styles.name, isDone && styles.nameDone]}>{name}</Text>
        <Text style={styles.prescription}>
          {formatPrescription(prescribedSets, prescribedReps)}
        </Text>
      </View>

      {/* Col 3: auto — stepper */}
      <TodayStepper
        value={setsCompleted}
        onDecrement={() => onSetsChange(Math.max(0, setsCompleted - 1))}
        onIncrement={() => onSetsChange(setsCompleted + 1)}
        doneAt={prescribedSets}
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

  containerLast: {
    borderBottomWidth: 0,
  } as ViewStyle,

  containerDone: {
    opacity: 0.5,
  } as ViewStyle,

  indicator: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  index: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.text.muted,
    letterSpacing: 0.44,
  } as TextStyle,

  checkSquare: {
    width: 16,
    height: 16,
    backgroundColor: Colors.moss,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  meta: {
    flex: 1,
    gap: 2,
  } as ViewStyle,

  name: {
    ...Typography.h3,
    color: Colors.text.primary,
  } as TextStyle,

  nameDone: {
    textDecorationLine: 'line-through',
    textDecorationColor: Colors.text.muted,
  } as TextStyle,

  prescription: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.22,
    color: Colors.text.muted,
  } as TextStyle,
});
