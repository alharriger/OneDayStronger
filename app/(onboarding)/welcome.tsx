import React from 'react';
import { View, Text, StyleSheet, ScrollView, ViewStyle, TextStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { Colors, Typography, Spacing } from '@/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          {/* Illustration placeholder — Phase 3 will add actual SVG */}
          <View style={styles.illustrationPlaceholder} accessibilityElementsHidden />
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>One Day Stronger</Text>
          <Text style={styles.subtitle}>
            Your personalized rehab companion for proximal hamstring tendinopathy.
          </Text>
          <Text style={styles.body}>
            We'll ask a few questions about your injury and goals, then build a recovery plan
            tailored to where you are right now.
          </Text>
          <Text style={styles.disclaimer}>
            This app is an educational tool, not a replacement for professional medical care.
            Always consult a healthcare provider before starting any rehabilitation program.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Get started"
          onPress={() => router.push('/(onboarding)/intake')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg.base,
  } as ViewStyle,

  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.space5,
    paddingTop: Spacing.space10,
    paddingBottom: Spacing.space8,
  } as ViewStyle,

  hero: {
    alignItems: 'center',
    marginBottom: Spacing.space10,
  } as ViewStyle,

  illustrationPlaceholder: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.bg.surface,
  } as ViewStyle,

  copy: {
    gap: Spacing.space4,
  } as ViewStyle,

  title: {
    ...Typography.display,
    color: Colors.primaryDark,
    textAlign: 'center',
  } as TextStyle,

  subtitle: {
    ...Typography.h2,
    color: Colors.text.primary,
    textAlign: 'center',
  } as TextStyle,

  body: {
    ...Typography.bodyLarge,
    color: Colors.text.primary,
    textAlign: 'center',
  } as TextStyle,

  disclaimer: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.space2,
  } as TextStyle,

  footer: {
    paddingHorizontal: Spacing.space5,
    paddingBottom: Spacing.space6,
    paddingTop: Spacing.space4,
  } as ViewStyle,
});
