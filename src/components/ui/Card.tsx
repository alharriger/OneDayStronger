import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, Shadows } from '@/theme';

export type CardVariant = 'standard' | 'phase' | 'event';
export type EventType = 'progression' | 'regression' | 'hold';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  eventType?: EventType;
  style?: ViewStyle;
}

const eventBorderColor: Record<EventType, string> = {
  progression: Colors.semantic.success,
  regression: Colors.semantic.danger,
  hold: Colors.semantic.warning,
};

export function Card({ children, variant = 'standard', eventType, style }: CardProps) {
  const leftBorderColor =
    variant === 'phase'
      ? Colors.primary
      : variant === 'event' && eventType
      ? eventBorderColor[eventType]
      : undefined;

  return (
    <View style={[styles.card, style]}>
      {leftBorderColor && (
        <View style={[styles.leftBorder, { backgroundColor: leftBorderColor }]} />
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.surfaceRaised,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Shadows.sm,
  } as ViewStyle,

  leftBorder: {
    width: 4,
  } as ViewStyle,

  content: {
    flex: 1,
    padding: Spacing.cardPadding,
  } as ViewStyle,
});
