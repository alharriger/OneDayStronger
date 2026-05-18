// =============================================================================
// Border radius tokens — v2 (Athletic Naturalist)
// Sharp by default. 0px everywhere. The single concession is 2px on tiny
// data chips inside dense rows. Anything with a visible radius reads as v1.
// =============================================================================

export const Radius = {
  none: 0,      // default — cards, buttons, modals, inputs, sliders
  chip: 2,      // tiny data chips inside dense rows only
  full: 9999,   // retained for avatar / pill shapes only
} as const;
