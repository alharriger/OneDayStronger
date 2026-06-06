import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, FontFamily } from '@/theme';

interface TodayStepperProps {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  min?: number;
  max?: number;
  /**
   * Threshold at which the visual "done" state activates (moss colors, check
   * on the row). Defaults to max. The plus button remains enabled beyond this.
   */
  doneAt?: number;
}

export function TodayStepper({
  value,
  onDecrement,
  onIncrement,
  min = 0,
  max = 99,
  doneAt,
}: TodayStepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;
  const isDone = value >= (doneAt ?? max);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, styles.buttonLeft]}
        onPress={onDecrement}
        disabled={atMin}
        accessibilityRole="button"
        accessibilityLabel="Decrease sets"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 0 }}
      >
        <Text style={[styles.symbol, atMin ? styles.symbolMuted : styles.symbolActive]}>−</Text>
      </TouchableOpacity>

      <View style={styles.countDisplay}>
        <Text style={[styles.count, isDone && styles.countDone]}>{value}</Text>
      </View>

      <TouchableOpacity
        style={[styles.button, styles.buttonRight, isDone && styles.buttonDone]}
        onPress={onIncrement}
        disabled={atMax}
        accessibilityRole="button"
        accessibilityLabel="Increase sets"
        hitSlop={{ top: 8, bottom: 8, left: 0, right: 8 }}
      >
        <Text style={[styles.symbol, isDone ? styles.symbolOnDark : styles.symbolActive]}>+</Text>
      </TouchableOpacity>

      <Text style={styles.ofLabel}>of {doneAt ?? max}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,

  button: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.faint,
  } as ViewStyle,

  buttonLeft: {
    borderRightWidth: 0,
  } as ViewStyle,

  buttonRight: {
    borderLeftWidth: 0,
  } as ViewStyle,

  buttonDone: {
    backgroundColor: Colors.moss,
    borderColor: Colors.moss,
  } as ViewStyle,

  countDisplay: {
    width: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.faint,
  } as ViewStyle,

  count: {
    fontFamily: FontFamily.monoMd,
    fontSize: 14,
    lineHeight: 14,
    color: Colors.text.primary,
  } as TextStyle,

  countDone: {
    color: Colors.moss,
  } as TextStyle,

  symbol: {
    fontFamily: FontFamily.mono,
    fontSize: 18,
    lineHeight: 22,
  } as TextStyle,

  symbolActive: {
    color: Colors.primary,
  } as TextStyle,

  symbolMuted: {
    color: Colors.text.muted,
  } as TextStyle,

  symbolOnDark: {
    color: Colors.text.onDark,
  } as TextStyle,

  ofLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    lineHeight: 14,
    color: Colors.text.muted,
    letterSpacing: 0.4,
    marginLeft: 8,
  } as TextStyle,
});
