import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Typography, Radius, Spacing } from '@/theme';

export type ButtonVariant = 'hero' | 'primary' | 'secondary' | 'destructive';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[styles.base, styles[variant], isDisabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' ? Colors.primary : Colors.text.onDark}
          size="small"
        />
      ) : (
        <Text style={[styles.label, labelColor[variant], isDisabled && styles.labelDisabled]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: Radius.none,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.space5,
    minWidth: 44,
  } as ViewStyle,

  // Hero — forward motion CTAs: Start workout, Begin session, Mark complete.
  // Uses moss green (progression color). One per screen max.
  hero: {
    backgroundColor: Colors.moss,
  } as ViewStyle,

  // Primary — slate, the workhorse for everything else.
  primary: {
    backgroundColor: Colors.primary,
  } as ViewStyle,

  // Secondary — ghost with hairline-faint outline. Never primary color.
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border.faint,
  } as ViewStyle,

  // Destructive — brick red, safety contexts only.
  destructive: {
    backgroundColor: Colors.semantic.danger,
  } as ViewStyle,

  disabled: {
    backgroundColor: Colors.bg.surface,
    borderColor: Colors.bg.surface,
    borderWidth: 0,
  } as ViewStyle,

  label: {
    ...Typography.buttonLabel,
  } as TextStyle,

  labelDisabled: {
    color: Colors.text.disabled,
  } as TextStyle,
});

const labelColor: Record<ButtonVariant, TextStyle> = {
  hero:        { color: Colors.text.onDark },
  primary:     { color: Colors.text.onDark },
  secondary:   { color: Colors.text.secondary },
  destructive: { color: Colors.text.onDark },
};
