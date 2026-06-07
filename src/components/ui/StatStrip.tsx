import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, Typography, FontFamily } from '@/theme';

export interface StatItem {
  value: string | number;
  unit?: string;
  label: string;
}

interface StatStripProps {
  items: StatItem[];
}

export function StatStrip({ items }: StatStripProps) {
  return (
    <View style={styles.container}>
      {items.map((item, i) => (
        <View key={i} style={[styles.column, i > 0 && styles.columnDivider]}>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{item.value}</Text>
            {item.unit ? <Text style={styles.unit}>{item.unit}</Text> : null}
          </View>
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border.strong,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  } as ViewStyle,

  column: {
    flex: 1,
    paddingVertical: 14,
    gap: 4,
  } as ViewStyle,

  columnDivider: {
    paddingLeft: 14,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border.faint,
  } as ViewStyle,

  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  } as ViewStyle,

  value: {
    ...Typography.stat,
  } as TextStyle,

  unit: {
    fontFamily: FontFamily.monoMd,
    fontSize: 11,
    lineHeight: 11,
    color: Colors.primary,
  } as TextStyle,

  label: {
    ...Typography.eyebrow,
    color: Colors.text.muted,
  } as TextStyle,
});
