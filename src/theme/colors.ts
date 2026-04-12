// =============================================================================
// Color tokens — One Day Stronger design system
// =============================================================================

const palette = {
  deepTeal: '#085041',
  primaryTeal: '#0F6E56',
  accent: '#1D9E75',
  coolWhite: '#F7F8F9',
  surface: '#E4E8EB',
  warmAmber: '#BA7517',
  painFlag: '#E24B4A',
  white: '#FFFFFF',
  nearBlack: '#1C2B27',
  secondaryText: '#4A6660',
  disabledText: '#9BAAA6',
  border: '#C8D2D0',
} as const;

export const Colors = {
  // ── Raw palette (use semantic tokens in components) ──
  palette,

  // ── Backgrounds ──
  bg: {
    base: palette.coolWhite,
    surface: palette.surface,
    surfaceRaised: palette.white,
  },

  // ── Brand ──
  primary: palette.primaryTeal,
  primaryDark: palette.deepTeal,
  accent: palette.accent,

  // ── Semantic ──
  semantic: {
    success: palette.accent,
    warning: palette.warmAmber,
    danger: palette.painFlag,
  },

  // ── Text ──
  text: {
    primary: palette.nearBlack,
    secondary: palette.secondaryText,
    disabled: palette.disabledText,
    onDark: palette.coolWhite,
  },

  // ── Borders ──
  border: {
    default: palette.border,
    focus: palette.primaryTeal,
  },
} as const;

/**
 * Returns the appropriate color for a pain score (0–10).
 * 0–3 → success (accent green)
 * 4–6 → warning (amber)
 * 7–10 → danger (pain flag red)
 *
 * Never use red outside of pain/safety contexts.
 */
export function getPainColor(score: number): string {
  if (score <= 3) return Colors.semantic.success;
  if (score <= 6) return Colors.semantic.warning;
  return Colors.semantic.danger;
}
