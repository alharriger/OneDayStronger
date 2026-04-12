import { Platform, ViewStyle } from 'react-native';

// =============================================================================
// Elevation / shadow tokens
// Flat and calm — only 3 levels above 0.
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: iosOffsetY },
    shadowOpacity: iosOpacity,
    shadowRadius: iosRadius,
  };
}

export const Shadows = {
  /** No shadow — flush to background */
  none: shadow(0, 0, 0, 0),

  /** Cards, input fields */
  sm: shadow(0.06, 4, 1, 2),

  /** Bottom sheets, modals, floating action */
  md: shadow(0.10, 12, 4, 6),

  /** Safety advisory overlay */
  lg: shadow(0.14, 20, 8, 12),
} as const;
