import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import { Colors, Typography, Spacing, getPainColor } from '@/theme';

interface PainScaleProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  minLabel?: string;
  maxLabel?: string;
  min?: number;
  max?: number;
}

export function PainScale({
  value,
  onChange,
  label,
  minLabel = '0  No pain',
  maxLabel = '10  Worst pain',
  min = 0,
  max = 10,
}: PainScaleProps) {
  const painColor = getPainColor(value);

  const handleChange = useCallback(
    (v: number) => {
      // Round to nearest integer for discrete 0–10 stops
      onChange(Math.round(v));
    },
    [onChange]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      {/* Value display */}
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: painColor }]}>{value}</Text>
      </View>

      {/* Slider */}
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={1}
        value={value}
        onValueChange={handleChange}
        minimumTrackTintColor={painColor}
        maximumTrackTintColor={Colors.bg.surface}
        thumbTintColor={Platform.OS === 'android' ? painColor : undefined}
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value }}
      />

      {/* Endpoint labels */}
      <View style={styles.endpointRow}>
        <Text style={styles.endpoint}>{minLabel}</Text>
        <Text style={styles.endpoint}>{maxLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.space2,
  } as ViewStyle,

  label: {
    ...Typography.h3,
    color: Colors.text.primary,
  } as TextStyle,

  valueRow: {
    alignItems: 'center',
  } as ViewStyle,

  value: {
    ...Typography.h2,
  } as TextStyle,

  slider: {
    width: '100%',
    height: 40,
  } as ViewStyle,

  endpointRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -Spacing.space1,
  } as ViewStyle,

  endpoint: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  } as TextStyle,
});
