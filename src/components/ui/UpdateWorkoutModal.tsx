import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { ArrowUp, ArrowDown, PencilSimple, X } from 'phosphor-react-native';
import { Colors, Typography, Spacing, Radius } from '@/theme';

export type WorkoutUpdateType = 'advance' | 'phase_back' | 'other';

interface UpdateWorkoutModalProps {
  visible: boolean;
  loading: boolean;
  onClose: () => void;
  onSelect: (type: WorkoutUpdateType, note?: string) => void;
}

interface OptionConfig {
  type: WorkoutUpdateType;
  label: string;
  description: string;
  Icon: React.ComponentType<{ size: number; color: string; weight?: string }>;
  color: string;
}

const OPTIONS: OptionConfig[] = [
  {
    type: 'advance',
    label: 'Challenge me more',
    description: "Use next-phase exercises for today. Your plan phase doesn't change.",
    Icon: ArrowUp,
    color: Colors.semantic.good,
  },
  {
    type: 'phase_back',
    label: 'Ease it up',
    description: "Regenerate today's workout at the conservative end of your current phase.",
    Icon: ArrowDown,
    color: Colors.primary,
  },
  {
    type: 'other',
    label: 'Something else',
    description: 'Describe what you need and we\'ll adjust today\'s workout.',
    Icon: PencilSimple,
    color: Colors.text.secondary,
  },
];

export function UpdateWorkoutModal({ visible, loading, onClose, onSelect }: UpdateWorkoutModalProps) {
  const [selectedType, setSelectedType] = useState<WorkoutUpdateType | null>(null);
  const [note, setNote] = useState('');

  const handleSelect = (type: WorkoutUpdateType) => {
    if (type !== 'other') {
      onSelect(type);
      return;
    }
    setSelectedType('other');
  };

  const handleApplyNote = () => {
    if (!note.trim()) return;
    onSelect('other', note.trim());
  };

  const handleClose = () => {
    setSelectedType(null);
    setNote('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Update this workout</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.loadingText}>Generating your updated workout…</Text>
            </View>
          ) : selectedType === 'other' ? (
            <View style={styles.noteContainer}>
              <Text style={styles.noteLabel}>What do you need?</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="e.g. I only have 15 minutes, or my left hamstring is sore"
                placeholderTextColor={Colors.text.muted}
                multiline
                autoFocus
              />
              <View style={styles.noteActions}>
                <TouchableOpacity
                  style={styles.noteBack}
                  onPress={() => setSelectedType(null)}
                >
                  <Text style={styles.noteBackText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.applyButton, !note.trim() && styles.applyButtonDisabled]}
                  onPress={handleApplyNote}
                  disabled={!note.trim()}
                >
                  <Text style={styles.applyButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.optionList}>
              {OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.type}
                  style={styles.optionRow}
                  onPress={() => handleSelect(opt.type)}
                  accessibilityRole="button"
                >
                  <View style={[styles.optionIcon, { backgroundColor: `${opt.color}1F` }]}>
                    <opt.Icon size={20} color={opt.color} />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                    <Text style={styles.optionDescription}>{opt.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.space5,
  } as ViewStyle,
  card: {
    backgroundColor: Colors.bg.surfaceRaised,
    borderRadius: Radius.xl,
    padding: Spacing.space5,
    width: '100%',
    gap: Spacing.space4,
  } as ViewStyle,
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  title: {
    ...Typography.h2,
    color: Colors.text.primary,
  } as TextStyle,
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.space4,
    gap: Spacing.space3,
  } as ViewStyle,
  loadingText: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  } as TextStyle,
  optionList: {
    gap: Spacing.space3,
  } as ViewStyle,
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.space3,
    paddingVertical: Spacing.space2,
  } as ViewStyle,
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as ViewStyle,
  optionText: {
    flex: 1,
    gap: 2,
  } as ViewStyle,
  optionLabel: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.text.primary,
  } as TextStyle,
  optionDescription: {
    ...Typography.label,
    color: Colors.text.secondary,
  } as TextStyle,
  noteContainer: {
    gap: Spacing.space3,
  } as ViewStyle,
  noteLabel: {
    ...Typography.label,
    color: Colors.text.secondary,
  } as TextStyle,
  noteInput: {
    ...Typography.body,
    color: Colors.text.primary,
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    padding: Spacing.space3,
    minHeight: 80,
    textAlignVertical: 'top',
  } as TextStyle,
  noteActions: {
    flexDirection: 'row',
    gap: Spacing.space3,
    justifyContent: 'flex-end',
  } as ViewStyle,
  noteBack: {
    paddingVertical: Spacing.space2,
    paddingHorizontal: Spacing.space3,
  } as ViewStyle,
  noteBackText: {
    ...Typography.body,
    color: Colors.text.secondary,
  } as TextStyle,
  applyButton: {
    backgroundColor: Colors.moss,
    borderRadius: Radius.md,
    paddingVertical: Spacing.space2,
    paddingHorizontal: Spacing.space4,
  } as ViewStyle,
  applyButtonDisabled: {
    opacity: 0.4,
  } as ViewStyle,
  applyButtonText: {
    ...Typography.body,
    color: Colors.text.onDark,
    fontWeight: '600',
  } as TextStyle,
});
