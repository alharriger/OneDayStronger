import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ScrollView,
} from 'react-native';
import { Warning } from 'phosphor-react-native';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import { Button } from './Button';

const DISCLAIMER =
  'One Day Stronger is an educational tool and is not a substitute for professional medical care.';

interface SafetyAdvisoryModalProps {
  visible: boolean;
  title: string;
  body: string;
  onAcknowledge: () => void;
}

/**
 * Non-dismissable safety advisory overlay.
 * Shown when pain thresholds are crossed or atypical symptoms are reported.
 * Cannot be closed by tapping the backdrop — user must explicitly acknowledge.
 *
 * Tone: caring, not alarming. Never use "error" or "failure" in content.
 */
export function SafetyAdvisoryModal({
  visible,
  title,
  body,
  onAcknowledge,
}: SafetyAdvisoryModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        // Back button on Android — do nothing, modal is non-dismissable
      }}
    >
      {/* Scrim */}
      <View style={styles.scrim}>
        {/* Panel */}
        <View style={styles.panel}>
          {/* Danger accent bar */}
          <View style={styles.accentBar} />

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Warning size={32} color={Colors.semantic.danger} />

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>

            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
            </View>

            <Button
              label="I understand, I'll seek care"
              variant="destructive"
              onPress={onAcknowledge}
              style={styles.cta}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.40)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.space5,
  } as ViewStyle,

  panel: {
    backgroundColor: Colors.bg.surfaceRaised,
    borderRadius: Radius.xl,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
    ...Shadows.lg,
  } as ViewStyle,

  accentBar: {
    height: 4,
    backgroundColor: Colors.semantic.danger,
  } as ViewStyle,

  content: {
    padding: Spacing.space5,
    gap: Spacing.space4,
    alignItems: 'flex-start',
  } as ViewStyle,

  title: {
    ...Typography.h2,
    color: Colors.text.primary,
  } as TextStyle,

  body: {
    ...Typography.bodyLarge,
    color: Colors.text.primary,
  } as TextStyle,

  disclaimerBox: {
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.md,
    padding: Spacing.space3,
    width: '100%',
  } as ViewStyle,

  disclaimer: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  } as TextStyle,

  cta: {
    width: '100%',
  } as ViewStyle,
});
