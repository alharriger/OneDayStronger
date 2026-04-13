import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { Button, PainScale } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { getProfile } from '@/services/profiles';
import { getInjuryIntake, getInjuryStatus, updateInjuryStatus } from '@/services/intake';
import { invokeRevisePlan } from '@/services/revision';
import { signOut } from '@/lib/auth';
import type { Database } from '@/lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type InjuryIntake = Database['public']['Tables']['injury_intake']['Row'];
type InjuryStatus = Database['public']['Tables']['injury_status']['Row'];

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ─── Readonly intake row ──────────────────────────────────────────────────────

function IntakeRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.intakeRow}>
      <Text style={styles.intakeLabel}>{label}</Text>
      <Text style={styles.intakeValue}>{value ?? '—'}</Text>
    </View>
  );
}

// ─── Profile screen ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [intake, setIntake] = useState<InjuryIntake | null>(null);
  const [status, setStatus] = useState<InjuryStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable injury status fields
  const [painBaseline, setPainBaseline] = useState(0);
  const [symptoms, setSymptoms] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [revisePlanLoading, setRevisePlanLoading] = useState(false);
  // Track the pain baseline at load time to detect meaningful changes
  const [originalPainBaseline, setOriginalPainBaseline] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getProfile(user.id),
      getInjuryIntake(user.id),
      getInjuryStatus(user.id),
    ]).then(([p, i, s]) => {
      setProfile(p);
      setIntake(i);
      setStatus(s);
      if (s) {
        setPainBaseline(s.pain_level_baseline ?? 0);
        setSymptoms(s.current_symptoms ?? '');
        setOriginalPainBaseline(s.pain_level_baseline ?? 0);
      }
    }).finally(() => setLoading(false));
  }, [user]);

  const handleSaveStatus = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await updateInjuryStatus(user.id, {
      pain_level_baseline: painBaseline,
      current_symptoms: symptoms,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Error', 'Could not save your status. Please try again.');
      return;
    }

    setHasChanges(false);

    // Check if the pain baseline changed meaningfully (≥ 2 points)
    const painShift = originalPainBaseline !== null
      ? Math.abs(painBaseline - originalPainBaseline)
      : 0;
    setOriginalPainBaseline(painBaseline);

    if (painShift >= 2) {
      Alert.alert(
        'Status saved',
        'Your baseline pain has changed significantly. Would you like Claude to revise your rehabilitation plan based on your new status?',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Revise plan',
            onPress: () => handleRevisePlan(),
          },
        ]
      );
    } else {
      Alert.alert('Saved', 'Your injury status has been updated.');
    }
  };

  const handleRevisePlan = async () => {
    if (!user) return;
    setRevisePlanLoading(true);
    const { error } = await invokeRevisePlan({
      pain_level_baseline: painBaseline,
      current_symptoms: symptoms,
      last_flare_date: status?.last_flare_date ?? null,
    });
    setRevisePlanLoading(false);

    if (error) {
      Alert.alert('Could not revise plan', error);
    } else {
      Alert.alert(
        'Plan revised',
        'Your rehabilitation plan has been updated based on your new status. Check the Plan tab to see your revised program.'
      );
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  };

  const REHAB_GOAL_LABELS: Record<string, string> = {
    return_to_running: 'Return to running',
    pain_free_daily: 'Pain-free daily life',
    return_to_sport: 'Return to sport',
    other: 'Something else',
  };

  const MECHANISM_LABELS: Record<string, string> = {
    gradual: 'Gradual onset',
    acute: 'Acute injury',
    post_surgery: 'Post-surgery',
    unknown: 'Unknown',
  };

  const IRRITABILITY_LABELS: Record<string, string> = {
    low: 'Low',
    moderate: 'Moderate',
    high: 'High',
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Profile</Text>
        </View>

        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        )}

        {!loading && (
          <>
            {/* ── Injury status (editable) ── */}
            <SectionHeader title="Current injury status" />
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Pain baseline (0–10)</Text>
              <PainScale
                value={painBaseline}
                onValueChange={(v) => {
                  setPainBaseline(v);
                  setHasChanges(true);
                }}
                accessibilityLabel="Pain baseline"
              />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.space4 }]}>
                Current symptoms
              </Text>
              <TextInput
                style={styles.textArea}
                value={symptoms}
                onChangeText={(t) => {
                  setSymptoms(t);
                  setHasChanges(true);
                }}
                multiline
                numberOfLines={3}
                placeholder="Describe any current symptoms…"
                placeholderTextColor={Colors.text.disabled}
              />

              {hasChanges && (
                <Button
                  label="Save status"
                  onPress={handleSaveStatus}
                  loading={saving}
                  style={styles.saveButton}
                />
              )}
            </View>

            {/* ── Intake (read-only) ── */}
            {intake && (
              <>
                <SectionHeader title="Intake information" />
                <View style={styles.card}>
                  <IntakeRow label="Injury onset" value={intake.injury_onset_date} />
                  <IntakeRow
                    label="Mechanism"
                    value={MECHANISM_LABELS[intake.mechanism ?? ''] ?? intake.mechanism}
                  />
                  <IntakeRow
                    label="Irritability"
                    value={IRRITABILITY_LABELS[intake.irritability_level ?? ''] ?? intake.irritability_level}
                  />
                  <IntakeRow label="Prior treatment" value={intake.prior_treatment} />
                  <IntakeRow label="Training background" value={intake.training_background} />
                </View>
              </>
            )}

            {/* ── Goal ── */}
            {profile?.rehab_goal && (
              <>
                <SectionHeader title="Rehab goal" />
                <View style={styles.card}>
                  <Text style={styles.goalText}>
                    {REHAB_GOAL_LABELS[profile.rehab_goal] ?? profile.rehab_goal}
                  </Text>
                </View>
              </>
            )}

            {/* ── Revise plan loading state ── */}
            {revisePlanLoading && (
              <View style={styles.revisePlanBanner}>
                <ActivityIndicator color={Colors.primary} size="small" />
                <Text style={styles.revisePlanText}>
                  Revising your plan with Claude…
                </Text>
              </View>
            )}

            {/* ── Sign out ── */}
            <Button
              label="Sign out"
              variant="secondary"
              onPress={handleSignOut}
              style={styles.signOutButton}
            />

            <Text style={styles.disclaimer}>
              One Day Stronger is an educational tool and is not a substitute for professional
              medical care. Always consult a qualified healthcare professional before starting
              or modifying a rehabilitation program.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bg.base } as ViewStyle,
  scroll: { flex: 1 } as ViewStyle,
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing.space8,
  } as ViewStyle,
  header: { paddingTop: Spacing.space4, marginBottom: Spacing.space5 } as ViewStyle,
  screenTitle: { ...Typography.h1, color: Colors.text.primary } as TextStyle,
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.space8,
  } as ViewStyle,
  sectionHeader: {
    ...Typography.h2,
    color: Colors.text.primary,
    marginTop: Spacing.space5,
    marginBottom: Spacing.space3,
  } as TextStyle,
  card: {
    backgroundColor: Colors.bg.surfaceRaised,
    borderRadius: Radius.lg,
    padding: Spacing.space4,
    gap: Spacing.space2,
  } as ViewStyle,
  fieldLabel: {
    ...Typography.label,
    color: Colors.text.secondary,
  } as TextStyle,
  textArea: {
    ...Typography.body,
    color: Colors.text.primary,
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.md,
    padding: Spacing.space3,
    minHeight: 80,
    textAlignVertical: 'top',
  } as TextStyle,
  saveButton: { marginTop: Spacing.space2 } as ViewStyle,
  intakeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.space2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.default,
  } as ViewStyle,
  intakeLabel: {
    ...Typography.body,
    color: Colors.text.secondary,
    flex: 1,
  } as TextStyle,
  intakeValue: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'right',
  } as TextStyle,
  goalText: {
    ...Typography.body,
    color: Colors.text.primary,
  } as TextStyle,
  revisePlanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.space3,
    backgroundColor: Colors.bg.surfaceRaised,
    borderRadius: Radius.md,
    padding: Spacing.space4,
    marginTop: Spacing.space5,
  } as ViewStyle,
  revisePlanText: {
    ...Typography.body,
    color: Colors.text.secondary,
  } as TextStyle,
  signOutButton: { marginTop: Spacing.space6 } as ViewStyle,
  disclaimer: {
    ...Typography.bodySmall,
    color: Colors.text.disabled,
    textAlign: 'center',
    marginTop: Spacing.space5,
    lineHeight: 18,
  } as TextStyle,
});
