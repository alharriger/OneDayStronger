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
  /** When provided, renders the button as a flex-row with label left and arrow right. */
  arrow?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  arrow,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const labelStyle = [styles.label, labelColor[variant], isDisabled && styles.labelDisabled] as const;
  const arrowStyle = [styles.arrowText, labelColor[variant], isDisabled && styles.labelDisabled] as const;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        arrow ? styles.baseArrow : styles.baseCenter,
        styles[variant],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' ? Colors.primary : Colors.text.onDark}
          size="small"
        />
      ) : arrow ? (
        <>
          <Text style={labelStyle}>{label}</Text>
          <Text style={arrowStyle}>{arrow}</Text>
        </>
      ) : (
        <Text style={labelStyle}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: Radius.none,
    minWidth: 44,
  } as ViewStyle,

  // Centered layout (no arrow)
  baseCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.space5,
  } as ViewStyle,

  // Arrow layout — label left, arrow right
  baseArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
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

  arrowText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 16,
    lineHeight: 16,
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
