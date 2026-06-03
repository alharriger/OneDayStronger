import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Typography, Radius, Spacing } from '@/theme';

interface Option<T extends string> {
  label: string;
  value: T;
}

interface SegmentedSelectorProps<T extends string> {
  options: Option<T>[];
  selected: T | null;
  onChange: (value: T) => void;
  label?: string;
}

export function SegmentedSelector<T extends string>({
  options,
  selected,
  onChange,
  label,
}: SegmentedSelectorProps<T>) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        {options.map((option) => {
          const isSelected = option.value === selected;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.chip, isSelected && styles.chipSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={option.label}
            >
              <Text
                style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.space1,
  } as ViewStyle,

  label: {
    ...Typography.label,
    color: Colors.text.secondary,
  } as TextStyle,

  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.space2,
  } as ViewStyle,

  chip: {
    flexBasis: '46%',
    flexGrow: 1,
    paddingVertical: Spacing.space2,
    paddingHorizontal: Spacing.space3,
    borderRadius: Radius.none,
    borderWidth: 1,
    borderColor: Colors.border.faint,
    backgroundColor: Colors.bg.surface,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  } as ViewStyle,

  chipSelected: {
    backgroundColor: Colors.bg.surfaceRaised,
    borderColor: Colors.border.faint,
    borderBottomColor: Colors.primary,
  } as ViewStyle,

  chipLabel: {
    ...Typography.label,
    color: Colors.text.secondary,
    textAlign: 'center',
  } as TextStyle,

  chipLabelSelected: {
    color: Colors.primary,
  } as TextStyle,
});
