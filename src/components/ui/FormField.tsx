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

  // Focus: slate-light border + faint halo. Error: brick border + faint halo.
  const borderColor = error
    ? Colors.semantic.danger
    : focused
    ? Colors.border.focus
    : Colors.border.faint;

  const shadowStyle = focused
    ? { shadowColor: Colors.primaryLight, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.18, shadowRadius: 3 }
    : error
    ? { shadowColor: Colors.semantic.danger, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 3 }
    : {};

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        style={[
          styles.input,
          inputProps.multiline && styles.multiline,
          { borderColor },
          shadowStyle,
        ]}
        placeholderTextColor={Colors.text.muted}
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
    ...Typography.eyebrow,
    color: Colors.text.muted,
  } as TextStyle,

  input: {
    backgroundColor: Colors.bg.surface,   // sandstone fill
    borderRadius: Radius.none,
    borderWidth: 1,
    paddingHorizontal: Spacing.space3,
    paddingVertical: Spacing.space2,
    height: 44,
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
    fontFamily: Typography.eyebrow.fontFamily,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: Colors.semantic.danger,
  } as TextStyle,
});
