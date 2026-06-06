import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  PanResponder,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { Colors } from '@/theme';

interface PainScaleProps {
  value: number;
  onValueChange: (value: number) => void;
  label?: string;
  minLabel?: string;
  maxLabel?: string;
  min?: number;
  max?: number;
}

function getPainColor(v: number): string {
  if (v <= 3) return Colors.semantic.good;    // moss
  if (v <= 6) return Colors.semantic.warning; // watch/ochre
  return Colors.semantic.danger;              // stop/brick
}

const THUMB_SIZE = 28;
const TRACK_HEIGHT = 6;
const HIT_HEIGHT = 36;
const TICK_COUNT = 11;

export function PainScale({
  value,
  onValueChange,
  label,
  minLabel = '0  No pain',
  maxLabel = '10  Worst pain',
  min = 0,
  max = 10,
}: PainScaleProps) {
  const color = getPainColor(value);

  // Measured track width (set via onLayout) so we can compute pixel positions
  const [measuredWidth, setMeasuredWidth] = useState(0);

  // PageX offset for translating pointer pageX → local track X during drag
  const trackPageX = useRef(0);
  const trackRef = useRef<View>(null);

  // Stable ref to onValueChange so the panResponder doesn't hold a stale closure
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  // Compute value from a pageX position
  const xToValue = (pageX: number): number => {
    const localX = pageX - trackPageX.current;
    const clamped = Math.max(0, Math.min(measuredWidth, localX));
    const ratio = measuredWidth > 0 ? clamped / measuredWidth : 0;
    return Math.round(ratio * (max - min) + min);
  };
  const xToValueRef = useRef(xToValue);
  xToValueRef.current = xToValue;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        onValueChangeRef.current(xToValueRef.current(evt.nativeEvent.pageX));
      },
      onPanResponderMove: (evt) => {
        onValueChangeRef.current(xToValueRef.current(evt.nativeEvent.pageX));
      },
    })
  ).current;

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setMeasuredWidth(width);
    // Capture the track's page position for drag calculations
    trackRef.current?.measureInWindow((x: number) => {
      trackPageX.current = x;
    });
  };

  // Pixel positions computed from measuredWidth
  // Fill: 0 → measuredWidth
  const fillWidth = measuredWidth > 0
    ? (value - min) / (max - min) * measuredWidth
    : 0;

  // Thumb left edge: center aligns with fill edge, clamped so thumb stays in track bounds
  const thumbCenter = fillWidth;
  const thumbLeft = measuredWidth > 0
    ? Math.max(0, Math.min(measuredWidth - THUMB_SIZE, thumbCenter - THUMB_SIZE / 2))
    : 0;

  return (
    <View style={styles.container}>
      {/* Label row: eyebrow label left, large value right */}
      <View style={styles.labelRow}>
        <View>
          {label ? <Text style={styles.eyebrow}>{label}</Text> : null}
        </View>
        <Text style={[styles.valueText, { color }]}>{value}</Text>
      </View>

      {/* 28px gap between label row and slider */}
      <View style={{ height: 28 }} />

      {/* Slider hit area */}
      <View
        ref={trackRef}
        onLayout={onTrackLayout}
        style={styles.hitArea}
        {...panResponder.panHandlers}
      >
        {/* Track background */}
        <View style={styles.trackBg} />

        {/* Colored fill */}
        <View
          style={[
            styles.trackFill,
            { width: fillWidth, backgroundColor: color },
          ]}
        />

        {/* Tick marks */}
        <View style={styles.tickRow} pointerEvents="none">
          {Array.from({ length: TICK_COUNT }, (_, i) => (
            <View key={i} style={styles.tick} />
          ))}
        </View>

        {/* Thumb */}
        {measuredWidth > 0 && (
          <View
            style={[styles.thumb, { left: thumbLeft }]}
            pointerEvents="none"
          >
            <View style={styles.gripLine} />
            <View style={styles.gripLine} />
          </View>
        )}
      </View>

      {/* Scale endpoint labels */}
      <View style={styles.endpointRow}>
        <Text style={styles.endpoint}>{minLabel}</Text>
        <Text style={styles.endpoint}>{maxLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {} as ViewStyle,

  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  } as ViewStyle,

  eyebrow: {
    fontFamily: 'Lato_700Bold',
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: Colors.text.muted,
  } as TextStyle,

  valueText: {
    fontFamily: 'Lato_900Black',
    fontSize: 56,
    lineHeight: 50, // 0.9 × 56
    letterSpacing: -2.24, // -0.04em at 56px
  } as TextStyle,

  hitArea: {
    height: HIT_HEIGHT,
    position: 'relative',
    justifyContent: 'center',
  } as ViewStyle,

  trackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    backgroundColor: Colors.bg.surfaceStrong,
  } as ViewStyle,

  trackFill: {
    position: 'absolute',
    left: 0,
    height: TRACK_HEIGHT,
  } as ViewStyle,

  tickRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 14,
  } as ViewStyle,

  tick: {
    width: 1,
    height: 14,
    backgroundColor: Colors.text.primary,
    opacity: 0.18,
  } as ViewStyle,

  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    top: (HIT_HEIGHT - THUMB_SIZE) / 2,
    backgroundColor: Colors.text.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    ...Platform.select({
      ios: {
        shadowColor: '#1F1A16',
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        shadowOpacity: 0.28,
      },
      android: {
        elevation: 4,
      },
    }),
  } as ViewStyle,

  gripLine: {
    width: 1,
    height: 12,
    backgroundColor: Colors.text.onDark,
    opacity: 0.65,
  } as ViewStyle,

  endpointRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  } as ViewStyle,

  endpoint: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 0.4,
    color: Colors.text.muted,
  } as TextStyle,
});
