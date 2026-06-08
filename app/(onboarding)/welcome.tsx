import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, FontFamily } from '@/theme';

function animStyle(val: Animated.Value) {
  return {
    opacity: val,
    transform: [{ translateY: val.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };
}

export default function WelcomeScreen() {
  const router = useRouter();

  const a0 = useRef(new Animated.Value(0)).current; // eyebrow  — 180ms
  const a1 = useRef(new Animated.Value(0)).current; // title    — 310ms
  const a2 = useRef(new Animated.Value(0)).current; // divider  — 460ms
  const a3 = useRef(new Animated.Value(0)).current; // body     — 600ms
  const a4 = useRef(new Animated.Value(0)).current; // footer   — 740ms

  useEffect(() => {
    const entry = (val: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, {
          toValue: 1,
          duration: 650,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]);

    Animated.parallel([
      entry(a0, 180),
      entry(a1, 310),
      entry(a2, 460),
      entry(a3, 600),
      entry(a4, 740),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Hero zone */}
      <View style={styles.hero}>
        <Animated.View style={[{ marginBottom: 18 }, animStyle(a0)]}>
          <Text style={styles.eyebrow}>One Day Stronger</Text>
        </Animated.View>

        <Animated.View style={[{ marginBottom: 30 }, animStyle(a1)]}>
          <Text style={styles.titleLine1}>One Day</Text>
          <Text style={styles.titleLine2}>Stronger.</Text>
        </Animated.View>

        <Animated.View style={[styles.divider, animStyle(a2)]}>
          <View style={styles.dividerDot} />
          <View style={styles.dividerLine} />
        </Animated.View>

        <Animated.View style={animStyle(a3)}>
          <Text style={styles.body}>
            {'A personalized rehab plan for proximal hamstring tendinopathy – built around where you are today.'}
          </Text>
        </Animated.View>
      </View>

      {/* Footer */}
      <Animated.View style={[styles.footer, animStyle(a4)]}>
        <Text style={styles.disclaimer}>
          {'Educational tool · Not a substitute for medical advice'}
        </Text>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => router.push('/(onboarding)/intake')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Get started"
        >
          <Text style={styles.ctaLabel}>Get started</Text>
          <Text style={styles.ctaArrow}>{'→'}</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.palette.ink,
  } as ViewStyle,

  hero: {
    flex: 1,
    paddingHorizontal: Spacing.screenHorizontal,
    justifyContent: 'center',
  } as ViewStyle,

  eyebrow: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: Colors.primary,
    lineHeight: 10,
  } as TextStyle,

  titleLine1: {
    fontFamily: FontFamily.black,
    fontSize: 72,
    lineHeight: 72 * 0.91,
    letterSpacing: 72 * -0.04,
    color: Colors.text.onDark,
  } as TextStyle,

  titleLine2: {
    fontFamily: FontFamily.black,
    fontSize: 72,
    lineHeight: 72 * 0.91,
    letterSpacing: 72 * -0.04,
    color: Colors.primary,
  } as TextStyle,

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 22,
  } as ViewStyle,

  dividerDot: {
    width: 4,
    height: 4,
    backgroundColor: Colors.primary,
  } as ViewStyle,

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(239, 234, 226, 0.10)',
  } as ViewStyle,

  body: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 14 * 1.6,
    color: 'rgba(239, 234, 226, 0.52)',
  } as TextStyle,

  footer: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: 44,
  } as ViewStyle,

  disclaimer: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    lineHeight: 9 * 1.65,
    color: 'rgba(239, 234, 226, 0.20)',
    marginBottom: 16,
  } as TextStyle,

  cta: {
    height: 52,
    backgroundColor: Colors.text.onDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenHorizontal,
  } as ViewStyle,

  ctaLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    letterSpacing: 13 * 0.08,
    textTransform: 'uppercase',
    color: Colors.text.primary,
  } as TextStyle,

  ctaArrow: {
    fontFamily: FontFamily.mono,
    fontSize: 16,
    color: Colors.text.primary,
  } as TextStyle,
});
