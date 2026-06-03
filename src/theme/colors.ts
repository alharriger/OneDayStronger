// =============================================================================
// Color tokens — One Day Stronger design system v2 (Athletic Naturalist)
// =============================================================================

const palette = {
  // Primary — Dusk Slate
  duskSlate:     '#4E6B82',
  fadedDenim:    '#7C95A7',  // hover / light
  deepDusk:      '#36506A',  // pressed / emphasis

  // Brand accents
  terra:         '#C17B5C',  // terracotta — brand accent, never on buttons
  terraLight:    '#D4956D',
  terraDark:     '#8C4E2E',
  moss:          '#5C7148',  // deep moss — progression / hero CTAs
  mossLight:     '#8AA170',  // lichen

  // Backgrounds / surfaces
  paper:         '#F5F1E9',  // page background
  espresso:      '#2C2420',  // inversion / dark mode
  sandstone:     '#EAE3D6',  // surface
  loam:          '#D8CDBC',  // surface-strong
  offWhite:      '#FBF8F2',  // card

  // Ink (text)
  ink:           '#1F1A16',  // near-black
  inkMid:        '#4F4640',  // mid ink
  inkMuted:      '#8C7E72',  // captions, hints
  inkOnDark:     '#EFEAE2',  // text on dark fills

  // Semantic
  ochre:         '#B8862A',  // modified / hold
  brick:         '#A8412C',  // pain threshold / safety

  // Lines
  lineStrong:    '#5F544A',  // section anchors
  line:          '#C8BDB1',  // default hairline
  lineFaint:     '#DCD5C9',  // row separators
} as const;

export const Colors = {
  // ── Raw palette (use semantic tokens in components) ──
  palette,

  // ── Backgrounds ──
  bg: {
    base:          palette.paper,
    surface:       palette.sandstone,
    surfaceStrong: palette.loam,
    surfaceRaised: palette.offWhite,
  },

  // ── Brand ──
  primary:       palette.duskSlate,
  primaryLight:  palette.fadedDenim,
  primaryDark:   palette.deepDusk,
  terra:         palette.terra,
  moss:          palette.moss,
  mossLight:     palette.mossLight,

  // ── Semantic ──
  semantic: {
    good:    palette.moss,    // low pain / progression
    warning: palette.ochre,   // modified / hold
    danger:  palette.brick,   // high pain / safety
  },

  // ── Text ──
  text: {
    primary:   palette.ink,
    secondary: palette.inkMid,
    muted:     palette.inkMuted,
    disabled:  palette.inkMuted,
    onDark:    palette.inkOnDark,
  },

  // ── Borders / hairlines ──
  border: {
    strong:   palette.lineStrong,
    default:  palette.line,
    faint:    palette.lineFaint,
    focus:    palette.fadedDenim,   // slate-light on focus
  },
} as const;

/**
 * Returns the appropriate color for a pain score (0–10).
 * 0–3 → moss (good)
 * 4–6 → ochre (watch)
 * 7–10 → brick (stop)
 *
 * Never use brick outside of pain/safety contexts.
 */
export function getPainColor(score: number): string {
  if (score <= 3) return Colors.semantic.good;
  if (score <= 6) return Colors.semantic.warning;
  return Colors.semantic.danger;
}
