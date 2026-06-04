import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, FontFamily } from '@/theme';

interface TodayStepperProps {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  min?: number;
  max?: number;
}

export function TodayStepper({
  value,
  onDecrement,
  onIncrement,
  min = 0,
  max = 20,
}: TodayStepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;

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
        <Text style={[styles.symbol, atMin && styles.symbolDisabled]}>−</Text>
      </TouchableOpacity>

      <View style={styles.countDisplay}>
        <Text style={styles.count}>{value}</Text>
      </View>

      <TouchableOpacity
        style={[styles.button, styles.buttonRight]}
        onPress={onIncrement}
        disabled={atMax}
        accessibilityRole="button"
        accessibilityLabel="Increase sets"
        hitSlop={{ top: 8, bottom: 8, left: 0, right: 8 }}
      >
        <Text style={[styles.symbol, atMax && styles.symbolDisabled]}>+</Text>
      </TouchableOpacity>
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

  symbol: {
    fontFamily: FontFamily.regular,
    fontSize: 18,
    lineHeight: 22,
    color: Colors.text.primary,
  } as TextStyle,

  symbolDisabled: {
    color: Colors.text.disabled,
  } as TextStyle,
});
