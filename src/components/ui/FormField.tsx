import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { Colors, Typography, Radius, Spacing } from '@/theme';

interface FormFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function FormField({ label, error, containerStyle, ...inputProps }: FormFieldProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? Colors.semantic.danger
    : focused
    ? Colors.border.focus
    : Colors.border.default;

  const borderWidth = focused || error ? 1.5 : 1;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        style={[
          styles.input,
          inputProps.multiline && styles.multiline,
          { borderColor, borderWidth },
        ]}
        placeholderTextColor={Colors.text.disabled}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
        accessibilityLabel={label}
        accessibilityHint={error}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.space1,
  } as ViewStyle,

  label: {
    ...Typography.label,
    color: Colors.text.secondary,
  } as TextStyle,

  input: {
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.space3,
    paddingVertical: Spacing.space2,
    height: 48,
    ...Typography.body,
    color: Colors.text.primary,
  } as TextStyle,

  multiline: {
    height: undefined,
    minHeight: 100,
    paddingTop: Spacing.space3,
    textAlignVertical: 'top',
  } as TextStyle,

  error: {
    ...Typography.bodySmall,
    color: Colors.semantic.danger,
  } as TextStyle,
});
