import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { ArrowCircleUp, ArrowCircleDown, PauseCircle, X } from 'phosphor-react-native';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import type { EventType } from './Card';

interface EvolutionEventBannerProps {
  eventType: EventType;
  title: string;
  rationale: string;
  onDismiss: () => void;
}

const config: Record<
  EventType,
  { color: string; Icon: React.ComponentType<{ size: number; color: string }> }
> = {
  progression: { color: Colors.semantic.success, Icon: ArrowCircleUp },
  regression: { color: Colors.semantic.danger, Icon: ArrowCircleDown },
  hold: { color: Colors.semantic.warning, Icon: PauseCircle },
};

export function EvolutionEventBanner({
  eventType,
  title,
  rationale,
  onDismiss,
}: EvolutionEventBannerProps) {
  const { color, Icon } = config[eventType];

  return (
    <View style={[styles.banner, { borderLeftColor: color }]}>
      <Icon size={20} color={color} />
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.rationale}>{rationale}</Text>
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityLabel="Dismiss"
      >
        <X size={18} color={Colors.text.secondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.bg.surfaceRaised,
    borderLeftWidth: 4,
    borderRadius: Radius.lg,
    padding: Spacing.space4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.space3,
  } as ViewStyle,

  textBlock: {
    flex: 1,
    gap: Spacing.space1,
  } as ViewStyle,

  title: {
    ...Typography.h3,
    color: Colors.text.primary,
  } as TextStyle,

  rationale: {
    ...Typography.body,
    color: Colors.text.secondary,
  } as TextStyle,
});
