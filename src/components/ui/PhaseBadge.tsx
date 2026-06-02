import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, Typography, Radius, Spacing } from '@/theme';

interface PhaseBadgeProps {
  phaseNumber: number;
  phaseName: string;
  isRegressed?: boolean;
}

export function PhaseBadge({ phaseNumber, phaseName, isRegressed = false }: PhaseBadgeProps) {
  const color = isRegressed ? Colors.semantic.danger : Colors.primary;
  const backgroundColor = isRegressed
    ? `${Colors.semantic.danger}1F` // 12% opacity
    : `${Colors.primary}1F`;

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text
        style={[styles.text, { color: isRegressed ? Colors.semantic.danger : Colors.primaryDark }]}
        numberOfLines={1}
      >
        Phase {phaseNumber} · {phaseName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    borderRadius: Radius.none,
    paddingVertical: Spacing.space1,
    paddingHorizontal: Spacing.space2,
  } as ViewStyle,

  text: {
    ...Typography.label,
  } as TextStyle,
});
