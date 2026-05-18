import { Platform, ViewStyle } from 'react-native';

// =============================================================================
// Elevation / shadow tokens — v2 (Athletic Naturalist)
// Cards and rows carry NO shadows. Hairlines do that structural work.
// Shadows appear only on overlays and the safety advisory modal.
// =============================================================================

type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

function shadow(
  iosOpacity: number,
  iosRadius: number,
  iosOffsetY: number,
  androidElevation: number
): ShadowStyle {
  if (Platform.OS === 'android') {
    return { elevation: androidElevation };
  }
  return {
    shadowColor: '#1F1A16',  // ink shadow color (not pure black)
    shadowOffset: { width: 0, height: iosOffsetY },
    shadowOpacity: iosOpacity,
    shadowRadius: iosRadius,
  };
}

export const Shadows = {
  /** No shadow — cards, rows, all content surfaces */
  none: shadow(0, 0, 0, 0),

  /** Bottom sheets, modals, floating action */
  md: shadow(0.08, 12, 2, 6),

  /** Safety advisory overlay */
  lg: shadow(0.14, 20, 8, 12),
} as const;
