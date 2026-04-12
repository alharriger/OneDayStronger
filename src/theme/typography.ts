import { StyleSheet, TextStyle } from 'react-native';

// =============================================================================
// Typography — One Day Stronger design system
// Font: Inter (loaded via @expo-google-fonts/inter)
// =============================================================================

export const FontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

// Raw scale values (used when constructing TextStyle manually)
export const FontSize = {
  display: 32,
  h1: 24,
  h2: 20,
  h3: 17,
  bodyLarge: 17,
  body: 15,
  bodySmall: 13,
  label: 13,
  labelLarge: 15,
} as const;

export const LineHeight = {
  display: 40,
  h1: 32,
  h2: 28,
  h3: 24,
  bodyLarge: 26,
  body: 22,
  bodySmall: 18,
  label: 18,
  labelLarge: 20,
} as const;

export const LetterSpacing = {
  display: -0.5,
  h1: -0.3,
  h2: -0.2,
  h3: 0,
  bodyLarge: 0,
  body: 0,
  bodySmall: 0.1,
  label: 0.3,
  labelLarge: 0.2,
} as const;

// Pre-built TextStyle objects for use in StyleSheet.create
export const Typography = StyleSheet.create({
  display: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.display,
    lineHeight: LineHeight.display,
    letterSpacing: LetterSpacing.display,
  } as TextStyle,

  h1: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.h1,
    lineHeight: LineHeight.h1,
    letterSpacing: LetterSpacing.h1,
  } as TextStyle,

  h2: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.h2,
    lineHeight: LineHeight.h2,
    letterSpacing: LetterSpacing.h2,
  } as TextStyle,

  h3: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.h3,
    lineHeight: LineHeight.h3,
    letterSpacing: LetterSpacing.h3,
  } as TextStyle,

  bodyLarge: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.bodyLarge,
    lineHeight: LineHeight.bodyLarge,
    letterSpacing: LetterSpacing.bodyLarge,
  } as TextStyle,

  body: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
    letterSpacing: LetterSpacing.body,
  } as TextStyle,

  bodySmall: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    letterSpacing: LetterSpacing.bodySmall,
  } as TextStyle,

  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.label,
    lineHeight: LineHeight.label,
    letterSpacing: LetterSpacing.label,
  } as TextStyle,

  labelLarge: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.labelLarge,
    lineHeight: LineHeight.labelLarge,
    letterSpacing: LetterSpacing.labelLarge,
  } as TextStyle,
});
