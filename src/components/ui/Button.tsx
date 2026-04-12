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

export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

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
      activeOpacity={0.85}
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
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.space5,
    minWidth: 44,
  } as ViewStyle,

  primary: {
    backgroundColor: Colors.primary,
  } as ViewStyle,

  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  } as ViewStyle,

  destructive: {
    backgroundColor: Colors.semantic.danger,
  } as ViewStyle,

  disabled: {
    backgroundColor: Colors.bg.surface,
    borderColor: Colors.bg.surface,
  } as ViewStyle,

  label: {
    ...Typography.labelLarge,
  } as TextStyle,

  labelDisabled: {
    color: Colors.text.disabled,
  } as TextStyle,
});

const labelColor: Record<ButtonVariant, TextStyle> = {
  primary: { color: Colors.text.onDark },
  secondary: { color: Colors.primary },
  destructive: { color: Colors.text.onDark },
};
