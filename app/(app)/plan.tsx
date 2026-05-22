import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretDown, CaretUp } from 'phosphor-react-native';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { PhaseBadge, Card, Button } from '@/components/ui';
import {
  getActivePlan,
  jumpToPhase,
  type ActivePlan,
  type PlanPhaseWithExercises,
} from '@/services/plans';
import { notifyPlanChanged } from '@/lib/planEvents';
import { useAuth } from '@/hooks/useAuth';

// ─── Exercise accordion ───────────────────────────────────────────────────────

interface PhaseExerciseAccordionProps {
  phase: PlanPhaseWithExercises;
}

function PhaseExerciseAccordion({ phase }: PhaseExerciseAccordionProps) {
  const [open, setOpen] = useState(false);

  const exercises = [...phase.phase_exercises].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
  );

  if (exercises.length === 0) return null;

  return (
    <View style={styles.exerciseAccordion}>
      <TouchableOpacity
        style={styles.exerciseAccordionHeader}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Collapse phase exercises' : 'Expand phase exercises'}
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.exerciseAccordionTitle}>Phase exercises</Text>
        {open ? (
          <CaretUp size={14} color={Colors.text.secondary} />
        ) : (
          <CaretDown size={14} color={Colors.text.secondary} />
        )}
      </TouchableOpacity>

      {open && (
        <View style={styles.exerciseList}>
          {exercises.map((pe, ei) => {
            const name = pe.name ?? pe.exercises?.name ?? 'Exercise';
            const sets = pe.prescribed_sets ?? '?';
            const reps = pe.prescribed_reps ?? '';
            const load = pe.load_target ?? '';
            return (
              <View key={pe.id ?? ei} style={styles.exerciseRow}>
                <Text style={styles.exerciseName}>{name}</Text>
                <Text style={styles.exerciseMeta}>
                  {sets}×{reps}
                  {load ? `  ·  ${load}` : ''}
                </Text>
                {pe.notes ? (
                  <Text style={styles.exerciseNotes}>{pe.notes}</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Phase section ────────────────────────────────────────────────────────────

interface PhaseSectionProps {
  phase: PlanPhaseWithExercises;
  isActive: boolean;       // currently active phase
  isExpanded: boolean;
  onToggle: () => void;
  onStartHere: () => void;
}

function PhaseSection({ phase, isActive, isExpanded, onToggle, onStartHere }: PhaseSectionProps) {
  const isCompleted = phase.status === 'completed';

  const statusLabel = isCompleted
    ? 'Completed'
    : isActive
    ? 'Current phase'
    : 'Upcoming';

  const statusColor = isCompleted
    ? Colors.semantic.good
    : isActive
    ? Colors.primary
    : Colors.text.disabled;

  const criteria = phase.progression_criteria as Record<string, number> | null;

  // Show the jump button on every phase EXCEPT the one currently active.
  const showJumpButton = !isActive;
  const jumpLabel = isCompleted ? 'Go back to this phase' : "I'm already here";

  return (
    <View style={[styles.phaseSection, isActive && styles.phaseSectionActive]}>
      {/* Tappable header — toggles expand/collapse */}
      <TouchableOpacity
        style={styles.phaseHeader}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} phase ${phase.phase_number}: ${phase.name}`}
        accessibilityState={{ expanded: isExpanded }}
      >
        <PhaseBadge
          phaseNumber={phase.phase_number}
          phaseName={phase.name}
          isRegressed={phase.status === 'regressed_from'}
        />
        <View style={styles.phaseHeaderRight}>
          <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
          {isExpanded ? (
            <CaretUp size={16} color={Colors.text.secondary} />
          ) : (
            <CaretDown size={16} color={Colors.text.secondary} />
          )}
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.phaseBody}>
          <Text style={styles.phaseDescription}>{phase.plain_language_summary}</Text>

          <View style={styles.criteriaRow}>
            <View style={styles.criteriaItem}>
              <Text style={styles.criteriaValue}>{criteria?.pain_threshold ?? '—'}/10</Text>
              <Text style={styles.criteriaLabel}>Max pain</Text>
            </View>
            <View style={styles.criteriaItem}>
              <Text style={styles.criteriaValue}>{phase.estimated_duration_weeks}w</Text>
              <Text style={styles.criteriaLabel}>Est. duration</Text>
            </View>
            <View style={styles.criteriaItem}>
              <Text style={styles.criteriaValue}>{criteria?.consistency_pct ?? '—'}%</Text>
              <Text style={styles.criteriaLabel}>Consistency</Text>
            </View>
          </View>

          <PhaseExerciseAccordion phase={phase} />

          {showJumpButton && (
            <Button
              variant="secondary"
              label={jumpLabel}
              onPress={onStartHere}
              style={styles.startHereButton}
            />
          )}
        </View>
      )}
    </View>
  );
}

// ─── Confirmation modal ───────────────────────────────────────────────────────

interface ConfirmJumpModalProps {
  visible: boolean;
  targetPhase: PlanPhaseWithExercises | null;
  currentPhase: PlanPhaseWithExercises | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmJumpModal({
  visible,
  targetPhase,
  currentPhase,
  loading,
  onConfirm,
  onCancel,
}: ConfirmJumpModalProps) {
  if (!targetPhase) return null;

  const isRegression =
    currentPhase !== null && targetPhase.phase_number < currentPhase.phase_number;

  const bodyText = isRegression
    ? `Phases ${targetPhase.phase_number + 1}–${currentPhase!.phase_number} will be marked as upcoming again. You'll restart your workouts from `
    : `You'll begin your daily workouts from `;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            Start at Phase {targetPhase.phase_number}?
          </Text>

          <Text style={styles.modalBody}>
            {bodyText}
            <Text style={styles.modalEmphasis}>{targetPhase.name}</Text>.
          </Text>

          <Text style={styles.modalHint}>
            {isRegression
              ? "Today's check-in and workout will reset so you can start fresh on this phase."
              : "Today's check-in and workout will reset to match this phase."}
          </Text>

          <View style={styles.modalActions}>
            <Button
              variant="secondary"
              label="Cancel"
              onPress={onCancel}
              style={styles.modalActionButton}
              disabled={loading}
            />
            <Button
              variant="primary"
              label={loading ? 'Saving…' : 'Yes, start here'}
              onPress={onConfirm}
              style={styles.modalActionButton}
              disabled={loading}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Plan screen ──────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded phase IDs — active phase starts expanded.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Jump-to-phase modal state.
  const [jumpTarget, setJumpTarget] = useState<PlanPhaseWithExercises | null>(null);
  const [jumpLoading, setJumpLoading] = useState(false);

  const userId = user?.id ?? null;

  const loadPlan = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    getActivePlan(userId)
      .then((p) => {
        setPlan(p);
        if (!p) {
          setError('No active plan found.');
        } else {
          // Default: expand the active phase.
          const active = p.plan_phases.find((ph) => ph.status === 'active');
          if (active) setExpandedIds(new Set([active.id]));
        }
      })
      .catch(() => setError('Could not load your plan.'))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const togglePhase = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const sortedPhases = plan?.plan_phases
    ? [...plan.plan_phases].sort((a, b) => a.phase_number - b.phase_number)
    : [];
  const activePhase = sortedPhases.find((p) => p.status === 'active') ?? null;
  const totalWeeks = sortedPhases.reduce((s, p) => s + (p.estimated_duration_weeks ?? 0), 0);

  const handleConfirmJump = async () => {
    if (!jumpTarget || !plan || !userId) return;
    setJumpLoading(true);

    const { error: jumpError } = await jumpToPhase({
      planId: plan.id,
      userId,
      targetPhaseId: jumpTarget.id,
      targetPhaseNumber: jumpTarget.phase_number,
      fromPhaseId: activePhase?.id ?? null,
      fromPhaseNumber: activePhase?.phase_number ?? null,
    });

    setJumpLoading(false);

    if (jumpError) {
      setJumpTarget(null);
      Alert.alert('Something went wrong', jumpError);
      return;
    }

    setJumpTarget(null);
    // Notify Today hook to re-initialize with the new phase.
    notifyPlanChanged();
    loadPlan();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Your Plan</Text>
        </View>

        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        )}

        {!loading && error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {!loading && plan && (
          <>
            <Card style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Plan overview</Text>
              <Text style={styles.summaryText}>{plan.plain_language_summary}</Text>
              <View style={styles.planMeta}>
                <Text style={styles.metaLabel}>
                  {sortedPhases.length} phases · {totalWeeks} weeks total
                </Text>
                {activePhase && (
                  <PhaseBadge
                    phaseNumber={activePhase.phase_number}
                    phaseName={activePhase.name}
                  />
                )}
              </View>
            </Card>

            <Text style={styles.sectionHeading}>Phases</Text>

            {sortedPhases.map((phase) => (
              <PhaseSection
                key={phase.id}
                phase={phase}
                isActive={phase.status === 'active'}
                isExpanded={expandedIds.has(phase.id)}
                onToggle={() => togglePhase(phase.id)}
                onStartHere={() => setJumpTarget(phase)}
              />
            ))}
          </>
        )}
      </ScrollView>

      <ConfirmJumpModal
        visible={jumpTarget !== null}
        targetPhase={jumpTarget}
        currentPhase={activePhase}
        loading={jumpLoading}
        onConfirm={handleConfirmJump}
        onCancel={() => setJumpTarget(null)}
      />
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
  errorText: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.space6,
  } as TextStyle,
  summaryCard: { marginBottom: Spacing.space5 } as ViewStyle,
  summaryTitle: {
    ...Typography.label,
    color: Colors.text.secondary,
    marginBottom: Spacing.space2,
  } as TextStyle,
  summaryText: {
    ...Typography.body,
    color: Colors.text.primary,
    marginBottom: Spacing.space4,
  } as TextStyle,
  planMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.space2,
  } as ViewStyle,
  metaLabel: { ...Typography.bodySmall, color: Colors.text.secondary } as TextStyle,
  sectionHeading: {
    ...Typography.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.space4,
  } as TextStyle,
  // Phase card
  phaseSection: {
    backgroundColor: Colors.bg.surfaceRaised,
    borderRadius: Radius.none,
    borderWidth: 1,
    borderColor: Colors.border.faint,
    marginBottom: Spacing.space4,
    overflow: 'hidden',
  } as ViewStyle,
  phaseSectionActive: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
  } as ViewStyle,
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.space4,
    gap: Spacing.space2,
  } as ViewStyle,
  phaseHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.space2,
    flexShrink: 1,
  } as ViewStyle,
  statusLabel: { ...Typography.label } as TextStyle,
  phaseBody: {
    paddingHorizontal: Spacing.space4,
    paddingBottom: Spacing.space4,
    gap: Spacing.space3,
  } as ViewStyle,
  phaseDescription: { ...Typography.body, color: Colors.text.secondary } as TextStyle,
  criteriaRow: { flexDirection: 'row', gap: Spacing.space4 } as ViewStyle,
  criteriaItem: { alignItems: 'center', gap: 2 } as ViewStyle,
  criteriaValue: { ...Typography.h3, color: Colors.text.primary } as TextStyle,
  criteriaLabel: { ...Typography.label, color: Colors.text.secondary } as TextStyle,
  startHereButton: { marginTop: Spacing.space2 } as ViewStyle,
  // Exercise accordion
  exerciseAccordion: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.faint,
    marginTop: Spacing.space2,
    paddingTop: Spacing.space3,
  } as ViewStyle,
  exerciseAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  exerciseAccordionTitle: {
    ...Typography.label,
    color: Colors.text.secondary,
  } as TextStyle,
  exerciseList: { gap: Spacing.space3, marginTop: Spacing.space3 } as ViewStyle,
  exerciseRow: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.border.faint,
    paddingLeft: Spacing.space3,
    gap: 2,
  } as ViewStyle,
  exerciseName: { ...Typography.bodySmall, color: Colors.text.primary, fontWeight: '600' } as TextStyle,
  exerciseMeta: { ...Typography.label, color: Colors.text.secondary } as TextStyle,
  exerciseNotes: { ...Typography.label, color: Colors.text.disabled, fontStyle: 'italic' } as TextStyle,
  // Confirmation modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.space5,
  } as ViewStyle,
  modalCard: {
    backgroundColor: Colors.bg.surfaceRaised,
    borderRadius: Radius.xl,
    padding: Spacing.space5,
    width: '100%',
    gap: Spacing.space4,
  } as ViewStyle,
  modalTitle: { ...Typography.h2, color: Colors.text.primary } as TextStyle,
  modalBody: { ...Typography.bodyLarge, color: Colors.text.primary } as TextStyle,
  modalEmphasis: { fontWeight: '600' } as TextStyle,
  modalHint: { ...Typography.bodySmall, color: Colors.text.secondary } as TextStyle,
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.space3,
    marginTop: Spacing.space2,
  } as ViewStyle,
  modalActionButton: { flex: 1 } as ViewStyle,
});
