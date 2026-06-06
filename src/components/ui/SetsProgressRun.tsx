import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, FontFamily } from '@/theme';

interface SetsProgressRunProps {
  /** Total number of segments (sum of prescribed sets across all exercises). */
  totalSegments: number;
  /** How many segments are filled (sum of completed sets, capped at prescribed). */
  completedSegments: number;
}

/**
 * Progress strip showing set completion. Includes status label row + bar.
 * Filled segments: primary normally, moss when all done.
 * Empty segments: surfaceStrong.
 */
export function SetsProgressRun({ totalSegments, completedSegments }: SetsProgressRunProps) {
  const filled = Math.min(completedSegments, totalSegments);
  const allDone = totalSegments > 0 && filled >= totalSegments;
  const accentColor = allDone ? Colors.moss : Colors.primary;

  return (
    <View style={styles.container}>
      {/* Label row */}
      <View style={styles.labelRow}>
        {/* Status pill */}
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, { backgroundColor: accentColor }]} />
          <Text style={[styles.statusText, { color: accentColor }]}>
            {allDone ? 'All complete' : 'In progress'}
          </Text>
        </View>

        {/* Sets count */}
        <Text style={styles.setsCount}>
          <Text style={styles.setsCountDone}>{filled}</Text>
          <Text style={styles.setsCountTotal}> / {totalSegments} SETS</Text>
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.barRow}>
        {Array.from({ length: totalSegments }, (_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              i < filled
                ? { backgroundColor: accentColor }
                : styles.segmentEmpty,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  } as ViewStyle,

  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  } as ViewStyle,

  statusDot: {
    width: 6,
    height: 6,
  } as ViewStyle,

  statusText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  } as TextStyle,

  setsCount: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    lineHeight: 16,
  } as TextStyle,

  setsCountDone: {
    fontFamily: FontFamily.monoMd,
    color: Colors.text.primary,
  } as TextStyle,

  setsCountTotal: {
    color: Colors.text.muted,
  } as TextStyle,

  barRow: {
    flexDirection: 'row',
    gap: 3,
  } as ViewStyle,

  segment: {
    flex: 1,
    height: 8,
  } as ViewStyle,

  segmentEmpty: {
    backgroundColor: Colors.bg.surfaceStrong,
  } as ViewStyle,
});
