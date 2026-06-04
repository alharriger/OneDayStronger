import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/theme';

interface SetsProgressRunProps {
  /** Total number of segments (sum of prescribed sets across all exercises). */
  totalSegments: number;
  /** How many segments are filled (sum of completed sets, capped at prescribed). */
  completedSegments: number;
}

/**
 * Horizontal progress strip showing set completion across all exercises.
 * Each segment = one prescribed set. Filled = moss, empty = lineFaint.
 */
export function SetsProgressRun({ totalSegments, completedSegments }: SetsProgressRunProps) {
  const filled = Math.min(completedSegments, totalSegments);

  return (
    <View style={styles.container}>
      {Array.from({ length: totalSegments }, (_, i) => (
        <View
          key={i}
          style={[styles.segment, i < filled ? styles.segmentFilled : styles.segmentEmpty]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 3,
  } as ViewStyle,

  segment: {
    flex: 1,
    height: 8,
  } as ViewStyle,

  segmentFilled: {
    backgroundColor: Colors.moss,
  } as ViewStyle,

  segmentEmpty: {
    backgroundColor: Colors.border.faint,
  } as ViewStyle,
});
