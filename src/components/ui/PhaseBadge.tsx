import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors } from '@/theme';

interface PhaseBadgeProps {
  phaseNumber: number;
  phaseName: string;
  isRegressed?: boolean;
  style?: ViewStyle;
}

export function PhaseBadge({ phaseNumber, phaseName, isRegressed = false, style }: PhaseBadgeProps) {
  const color = isRegressed ? Colors.semantic.danger : Colors.primary;

  return (
    <View style={[styles.container, { borderTopColor: color, borderBottomColor: color }, style]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>
        Phase {phaseNumber} · {phaseName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingRight: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  } as ViewStyle,

  dot: {
    width: 6,
    height: 6,
  } as ViewStyle,

  text: {
    fontFamily: 'Lato_700Bold',
    fontSize: 11,
    lineHeight: 11,
    letterSpacing: 1.76, // 0.16em at 11px
    textTransform: 'uppercase',
  } as TextStyle,
});
