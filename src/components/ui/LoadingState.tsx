import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, Typography, Spacing } from '@/theme';

interface LoadingStateProps {
  message: string;
}

/**
 * Always shows a message alongside the spinner.
 * Never display a bare spinner — the user should always know what's happening.
 */
export function LoadingState({ message }: LoadingStateProps) {
  return (
    <View style={styles.container} accessibilityLiveRegion="polite" accessibilityLabel={message}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.space4,
    padding: Spacing.screenHorizontal,
  } as ViewStyle,

  message: {
    ...Typography.bodyLarge,
    color: Colors.text.secondary,
    textAlign: 'center',
  } as TextStyle,
});
