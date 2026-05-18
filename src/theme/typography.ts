import { StyleSheet, TextStyle } from 'react-native';

// =============================================================================
// Typography — One Day Stronger design system v2 (Athletic Naturalist)
// Display + body: Lato (400 / 700 / 900)
// Numerics:       JetBrains Mono (400 / 500)
// =============================================================================

export const FontFamily = {
  // Lato — display, body, eyebrows, buttons
  regular:  'Lato_400Regular',
  bold:     'Lato_700Bold',
  black:    'Lato_900Black',   // display titles, hero numerics

  // JetBrains Mono — all numeric data: stats, sets, reps, dates, pain values
  mono:     'JetBrainsMono_400Regular',
  monoMd:   'JetBrainsMono_500Medium',
} as const;

// Raw scale — matches design token scale in colors_and_type.css
export const FontSize = {
  hero:       88,  // hero numeric moment
  display:    40,  // page-level title (Today, Plan, History)
  h1:         28,  // section hero
  h2:         20,  // section heads
  h3:         16,  // exercise names, card titles
  body:       14,  // body copy
  bodySmall:  12,  // captions, secondary
  label:      10,  // eyebrow / overline (UPPERCASE)
  stat:       22,  // stat strip tiles (mono)
} as const;

export const LineHeight = {
  tight:    1.0,
  display:  1.05,
  heading:  1.20,
  body:     1.50,
} as const;

// Pre-built TextStyle objects for use in StyleSheet.create
export const Typography = StyleSheet.create({
  // Page-level display title — Lato 700, 40px
  display: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.display,
    lineHeight: FontSize.display * 1.05,
    letterSpacing: -1.2,
  } as TextStyle,

  // Hero numeric — Lato 900, very large (use sparingly)
  hero: {
    fontFamily: FontFamily.black,
    fontSize: FontSize.hero,
    lineHeight: FontSize.hero * 1.0,
    letterSpacing: -3.5,
  } as TextStyle,

  h1: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h1,
    lineHeight: FontSize.h1 * 1.1,
    letterSpacing: -0.5,
  } as TextStyle,

  h2: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h2,
    lineHeight: FontSize.h2 * 1.2,
    letterSpacing: -0.3,
  } as TextStyle,

  h3: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h3,
    lineHeight: FontSize.h3 * 1.2,
    letterSpacing: 0,
  } as TextStyle,

  body: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    lineHeight: FontSize.body * 1.5,
    letterSpacing: 0,
  } as TextStyle,

  bodySmall: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.bodySmall,
    lineHeight: FontSize.bodySmall * 1.45,
    letterSpacing: 0,
  } as TextStyle,

  // Eyebrow / overline — UPPERCASE, tracked. Used heavily for chrome labels.
  eyebrow: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.label,
    lineHeight: FontSize.label * 1.0,
    letterSpacing: 1.6,   // 0.16em at 10px
    textTransform: 'uppercase' as const,
  } as TextStyle,

  // Stat tile numeric — JetBrains Mono 500
  stat: {
    fontFamily: FontFamily.monoMd,
    fontSize: FontSize.stat,
    lineHeight: FontSize.stat * 1.0,
    letterSpacing: -0.4,
  } as TextStyle,

  // Generic mono — sets, reps, dates, pain values
  mono: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.body,
    lineHeight: FontSize.body * 1.5,
    letterSpacing: 0,
  } as TextStyle,

  // Button label — Lato 700, uppercase tracked
  buttonLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    lineHeight: 13 * 1.0,
    letterSpacing: 0.8,   // ~0.06em
    textTransform: 'uppercase' as const,
  } as TextStyle,

  // Legacy aliases — kept so callers that reference these don't break
  bodyLarge: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    lineHeight: FontSize.body * 1.5,
    letterSpacing: 0,
  } as TextStyle,

  label: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.label,
    lineHeight: FontSize.label * 1.0,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
  } as TextStyle,

  labelLarge: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    lineHeight: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  } as TextStyle,
});
