import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
  Alert,
  NativeSyntheticEvent,
  TextLayoutEventData,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CalendarBlank, CheckCircle } from 'phosphor-react-native';
import { Colors, Typography, Spacing, FontFamily } from '@/theme';
import {
  Button,
  PainScale,
  PhaseBadge,
  PreWorkoutRow,
  StatStrip,
  LoadingState,
  SafetyAdvisoryModal,
  EvolutionEventBanner,
  UpdateWorkoutModal,
} from '@/components/ui';
import type { StatItem } from '@/components/ui';
import type { WorkoutUpdateType } from '@/components/ui';
import { useTodayWorkout, type CompletedSessionData } from '@/hooks/useTodayWorkout';
import { useAuth } from '@/hooks/useAuth';
import { acknowledgeSafetyEvent } from '@/services/safetyEvents';
import { getUnseenEvents, markEventSeen } from '@/services/evolution';

// ─── Check-in widget ──────────────────────────────────────────────────────────

interface CheckInWidgetProps {
  onSubmit: (pain: number, soreness: number) => void;
  loading?: boolean;
}

function CheckInWidget({ onSubmit, loading = false }: CheckInWidgetProps) {
  const [pain, setPain] = useState(0);
  const [soreness, setSoreness] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handlePress = async () => {
    setSubmitting(true);
    try {
      await onSubmit(pain, soreness);
      // Phase normally transitions away, unmounting this widget.
    } finally {
      // Reset in case phase stays at check_in (e.g. hook returned early).
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.checkInContainer}>
      {/* Section intro — lineStrong top border */}
      <View style={styles.sectionIntro}>
        <Text style={styles.sectionTitle}>How are you feeling?</Text>
        <Text style={styles.sectionSubtitle}>
          Rate your pain and soreness at the hamstring attachment site.
        </Text>
      </View>

      <View style={{ height: 28 }} />

      <PainScale
        value={pain}
        onValueChange={setPain}
        label="PAIN"
        minLabel="0 NO PAIN"
        maxLabel="10 WORST"
      />

      {/* Divider between scales */}
      <View style={styles.scaleDivider} />

      <PainScale
        value={soreness}
        onValueChange={setSoreness}
        label="SORENESS"
        minLabel="0 NONE"
        maxLabel="10 WORST"
      />

      <Button
        label="Generate my workout"
        variant="primary"
        arrow="→"
        onPress={handlePress}
        loading={submitting || loading}
        style={styles.checkInButton}
      />
    </View>
  );
}

// ─── Rest day card ────────────────────────────────────────────────────────────

interface RestDayCardProps {
  explanation: string;
}

function RestDayCard({ explanation }: RestDayCardProps) {
  return (
    <View style={styles.restCard}>
      <Text style={styles.restTitle}>Rest day recommended</Text>
      <Text style={styles.restBody}>{explanation}</Text>
    </View>
  );
}

// ─── Workout completed view ───────────────────────────────────────────────────

/** Format prescribed reps/seconds for the completion summary. */
function formatCompletedReps(reps: string | null): string {
  if (!reps) return '–';
  if (/\d+\s*(s|sec|seconds?)\b/i.test(reps)) {
    return reps.replace(/\s*seconds?\b/gi, 's');
  }
  return `${reps} reps`;
}

interface WorkoutCompletedViewProps {
  completedData: CompletedSessionData | null;
}

function StreakBar({ recentCompletedDates, today }: { recentCompletedDates: string[]; today: string }) {
  const completedSet = new Set(recentCompletedDates);
  const slots: string[] = [];
  // Build 14 slots ending at today (oldest first)
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    slots.push(d.toISOString().split('T')[0]);
  }
  return (
    <View style={completedStyles.streakBar}>
      {slots.map((date) => {
        const isToday = date === today;
        const isDone = completedSet.has(date);
        const bg = isToday
          ? Colors.moss
          : isDone
          ? Colors.mossLight
          : Colors.bg.surfaceStrong;
        return <View key={date} style={[completedStyles.streakSegment, { backgroundColor: bg }]} />;
      })}
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={completedStyles.statTile}>
      <Text style={completedStyles.statValue}>{value}</Text>
      <Text style={completedStyles.statLabel}>{label}</Text>
    </View>
  );
}

function WorkoutCompletedView({ completedData }: WorkoutCompletedViewProps) {
  const today = new Date().toISOString().split('T')[0];
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).toUpperCase().replace(',', ' ·');

  const durationStr = completedData?.durationMinutes != null
    ? `${completedData.durationMinutes}m`
    : '–';
  const exercisesStr = completedData ? String(completedData.exercises.length) : '–';
  const painStr = completedData?.painAtCheckin != null
    ? String(completedData.painAtCheckin)
    : '–';

  let nextDateStr = '';
  let nextLabel = 'Coming up';
  if (completedData?.nextWorkoutDate) {
    nextDateStr = new Date(completedData.nextWorkoutDate + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    nextLabel = 'In 2 days';
  }

  return (
    <View style={completedStyles.container}>
      {/* 1. Date meta row */}
      <Text style={completedStyles.dateMeta}>{dateLabel}</Text>

      {/* 2. Eyebrow */}
      <View style={completedStyles.eyebrowRow}>
        <View style={completedStyles.eyebrowDot} />
        <Text style={completedStyles.eyebrowText}>Workout complete</Text>
      </View>

      {/* 3. Hero title */}
      <Text style={completedStyles.heroTitle}>Today, done.</Text>

      {/* 4. Streak section */}
      <View style={completedStyles.section}>
        <View style={completedStyles.streakHeader}>
          <Text style={completedStyles.sectionEyebrow}>Streak</Text>
          <Text style={completedStyles.streakCount}>
            {completedData?.streakCount ?? '–'}
            <Text style={completedStyles.streakUnit}> days</Text>
          </Text>
        </View>
        <StreakBar
          recentCompletedDates={completedData?.recentCompletedDates ?? [today]}
          today={today}
        />
      </View>

      {/* 5. Stat strip */}
      <View style={completedStyles.statStrip}>
        <StatTile label="Duration" value={durationStr} />
        <View style={completedStyles.statDivider} />
        <StatTile label="Exercises" value={exercisesStr} />
        <View style={completedStyles.statDivider} />
        <StatTile label="Pain" value={painStr} />
      </View>

      {/* 6. Exercise list */}
      {completedData && completedData.exercises.length > 0 && (
        <View style={completedStyles.section}>
          <Text style={completedStyles.sectionEyebrow}>What you did</Text>
          {completedData.exercises.map((ex, i) => (
            <View key={ex.name} style={completedStyles.exerciseRow}>
              <Text style={completedStyles.exerciseIndex}>{i + 1}</Text>
              <View style={completedStyles.exerciseMeta}>
                <Text style={completedStyles.exerciseName}>{ex.name}</Text>
                <Text style={completedStyles.exerciseDetail}>
                  {`${ex.setsCompleted ?? 0} sets × ${formatCompletedReps(ex.prescribedReps)}`}
                </Text>
              </View>
              <CheckCircle size={20} color={Colors.moss} weight="fill" />
            </View>
          ))}
        </View>
      )}

      {/* 7. Next workout row */}
      <View style={completedStyles.nextRow}>
        <CalendarBlank size={18} color={Colors.text.secondary} />
        <View style={completedStyles.nextMeta}>
          <Text style={completedStyles.nextLabel}>{nextLabel}</Text>
          {nextDateStr ? <Text style={completedStyles.nextDate}>{nextDateStr}</Text> : null}
        </View>
      </View>

      {/* 8. Set a reminder CTA */}
      <TouchableOpacity
        style={completedStyles.reminderButton}
        onPress={() => Alert.alert('Coming soon', 'Workout reminders will be available in a future update.')}
        activeOpacity={0.8}
      >
        <Text style={completedStyles.reminderButtonText}>Set a reminder</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Collapsible explanation text ────────────────────────────────────────────

const EXPLANATION_MAX_LINES = 3;

function CollapsibleExplanation({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);

  const handleTextLayout = useCallback(
    (e: NativeSyntheticEvent<TextLayoutEventData>) => {
      if (e.nativeEvent.lines.length > EXPLANATION_MAX_LINES) {
        setTruncated(true);
      }
    },
    []
  );

  return (
    <View>
      <Text
        style={styles.explanationText}
        numberOfLines={expanded ? undefined : EXPLANATION_MAX_LINES}
        onTextLayout={truncated ? undefined : handleTextLayout}
      >
        {text}
      </Text>
      {truncated && (
        <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
          <Text style={styles.readMoreText}>{expanded ? 'Read less' : 'Read more'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Workout display ──────────────────────────────────────────────────────────

interface WorkoutDisplayProps {
  workoutType: 'standard' | 'modified' | 'rest_recommendation';
  explanation: string;
  exercises: Array<{
    exercise_name: string;
    sets: number;
    reps: string;
    load: string;
    tempo: string;
    rest_seconds: number;
    notes: string;
  }>;
  fallbackBanner?: string;
  currentWeek?: number | null;
  totalWeeks?: number | null;
  onStartWorkout: () => void;
  onUpdateWorkout: () => void;
}

function WorkoutDisplay({
  workoutType,
  explanation,
  exercises,
  fallbackBanner,
  currentWeek,
  totalWeeks,
  onStartWorkout,
  onUpdateWorkout,
}: WorkoutDisplayProps) {
  // Build stat strip items
  const statItems: StatItem[] = [
    {
      value: exercises.length,
      label: 'EXERCISES',
    },
    {
      value: exercises.length * 6,
      unit: 'MIN',
      label: 'EST. DURATION',
    },
  ];
  if (currentWeek != null && totalWeeks != null) {
    statItems.push({
      value: currentWeek,
      unit: `/${totalWeeks}`,
      label: 'WEEK',
    });
  }

  return (
    <View style={styles.workoutContainer}>
      {fallbackBanner && (
        <View style={styles.fallbackBanner}>
          <Text style={styles.fallbackBannerText}>{fallbackBanner}</Text>
        </View>
      )}

      {workoutType === 'modified' && (
        <View style={styles.modifiedBadge}>
          <Text style={styles.modifiedBadgeText}>Modified workout</Text>
        </View>
      )}

      {/* Stat strip */}
      <StatStrip items={statItems} />

      {/* Collapsible explanation */}
      <CollapsibleExplanation text={explanation} />

      {/* Exercise list */}
      <View style={styles.exerciseSection}>
        <View style={styles.exerciseSectionHeader}>
          <Text style={styles.exerciseSectionEyebrow}>Exercises</Text>
          <Text style={styles.exerciseCount}>{exercises.length} total</Text>
        </View>
        <View style={styles.exerciseList}>
          {exercises.map((ex, i) => (
            <PreWorkoutRow
              key={`${ex.exercise_name}-${i}`}
              index={i + 1}
              name={ex.exercise_name}
              sets={ex.sets}
              reps={ex.reps}
              load={ex.load || null}
              tempo={ex.tempo || null}
              restSeconds={ex.rest_seconds || null}
              notes={ex.notes || null}
              isLast={i === exercises.length - 1}
            />
          ))}
        </View>
      </View>

      <Button
        label="Start workout"
        variant="primary"
        arrow="→"
        onPress={onStartWorkout}
        style={styles.startButton}
      />

      <TouchableOpacity style={styles.updateWorkoutRow} onPress={onUpdateWorkout} activeOpacity={0.7}>
        <Text style={styles.updateWorkoutText}>Update this workout</Text>
        <Text style={styles.updateWorkoutArrow}>→</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Today screen ─────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const today = useTodayWorkout();
  const [showingSafety, setShowingSafety] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateModalLoading, setUpdateModalLoading] = useState(false);
  const [evolutionBanner, setEvolutionBanner] = useState<{
    eventType: 'progression' | 'regression' | 'hold' | 'plan_revised';
    rationale: string;
    eventId: string;
  } | null>(null);

  // Show safety modal when the phase transitions to safety_advisory
  React.useEffect(() => {
    if (today.phase === 'safety_advisory') {
      setShowingSafety(true);
    }
  }, [today.phase]);

  // Load unseen evolution events when the phase changes to any visible state.
  const BANNER_EVENT_TYPES = ['progression', 'regression', 'hold', 'plan_revised'] as const;
  type BannerEventType = typeof BANNER_EVENT_TYPES[number];

  React.useEffect(() => {
    if (!user || (
      today.phase !== 'workout_ready' &&
      today.phase !== 'check_in' &&
      today.phase !== 'workout_completed' &&
      today.phase !== 'generating'
    )) return;
    getUnseenEvents(user.id).then((events) => {
      const bannerEvent = events.find((e) =>
        BANNER_EVENT_TYPES.includes(e.event_type as BannerEventType)
      );
      if (bannerEvent) {
        setEvolutionBanner({
          eventType: bannerEvent.event_type as BannerEventType,
          rationale: bannerEvent.rationale ?? '',
          eventId: bannerEvent.id,
        });
      }
    });
  }, [user, today.phase]);

  const handleAcknowledgeSafety = async () => {
    if (today.safetyEventId && user) {
      await acknowledgeSafetyEvent(today.safetyEventId);
    }
    setShowingSafety(false);
    today.acknowledgeSafety();
  };

  const handleDismissEvolution = async () => {
    if (evolutionBanner && user) {
      await markEventSeen(evolutionBanner.eventId);
    }
    setEvolutionBanner(null);
  };

  const renderContent = () => {
    switch (today.phase) {
      case 'loading':
        return <LoadingState message="Loading your day..." />;

      case 'check_in':
        return <CheckInWidget onSubmit={today.submitCheckIn} />; // loading handled inside widget

      case 'generating':
        return <LoadingState message="Generating your workout…" />;

      case 'workout_ready':
        if (!today.workout) return null;
        return (
          <WorkoutDisplay
            workoutType={today.workout.workout_type}
            explanation={today.workout.plain_language_explanation}
            exercises={today.workout.exercises}
            fallbackBanner={today.workout.fallbackBanner}
            currentWeek={today.currentWeek}
            totalWeeks={today.totalWeeks}
            onStartWorkout={() => {
              if (!today.workout || !today.sessionId) return;
              const exercises = today.workout.exercises.map((e) => ({
                exerciseId: null,
                exerciseName: e.exercise_name,
                prescribedSets: e.sets,
                prescribedReps: e.reps ?? null,
              }));
              router.push({
                pathname: '/(app)/log-workout',
                params: {
                  sessionId: today.sessionId,
                  workoutId: today.workout.workoutId,
                  exercisesJson: JSON.stringify(exercises),
                  phaseNumber: String(today.phaseNumber ?? ''),
                  phaseName: today.phaseName ?? '',
                },
              });
            }}
            onUpdateWorkout={() => setShowUpdateModal(true)}
          />
        );

      case 'workout_completed':
        return <WorkoutCompletedView completedData={today.completedData} />;

      case 'rest_day':
        return (
          <RestDayCard
            explanation={
              today.workout?.plain_language_explanation ??
              'Rest today to let your tendon recover.'
            }
          />
        );

      case 'safety_advisory':
        return <LoadingState message="Loading safety advisory…" />;

      case 'error':
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{today.error}</Text>
            {today.isRetryable && (
              <Button
                label="Try again"
                variant="secondary"
                onPress={today.retryWorkoutGeneration}
                style={styles.retryButton}
              />
            )}
          </View>
        );
    }
  };

  const monoDateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).toUpperCase().replace(',', ' ·');

  // Show streak pill during check_in and workout_ready phases
  const showStreakPill =
    today.phase === 'check_in' || today.phase === 'workout_ready';

  // Show phase badge below hero for all phases except loading and workout_completed
  const showPhaseBadge =
    today.phase !== 'loading' &&
    today.phase !== 'workout_completed' &&
    today.phaseNumber != null &&
    today.phaseName != null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {evolutionBanner && (
          <EvolutionEventBanner
            eventType={evolutionBanner.eventType}
            title={
              evolutionBanner.eventType === 'progression'
                ? "You've advanced to a new phase"
                : evolutionBanner.eventType === 'regression'
                ? "Your plan has been adjusted"
                : evolutionBanner.eventType === 'plan_revised'
                ? "Your plan has been updated"
                : "Holding at your current phase"
            }
            rationale={evolutionBanner.rationale}
            onDismiss={handleDismissEvolution}
          />
        )}

        {today.phase !== 'workout_completed' && today.phase !== 'loading' && (
          <View style={styles.header}>
            {/* Row 1: date + streak pill */}
            <View style={styles.headerTopRow}>
              <Text style={styles.dateMeta}>{monoDateLabel}</Text>
              {showStreakPill && today.streakCount != null && today.streakCount > 0 && (
                <View style={styles.streakPill}>
                  <View style={styles.streakDot} />
                  <Text style={styles.streakText}>{today.streakCount}-DAY STREAK</Text>
                </View>
              )}
            </View>

            {/* Row 2: hero title */}
            <Text style={styles.screenHero}>
              {today.phase === 'workout_ready' ? 'Today\'s session.' : 'Today'}
            </Text>

            {/* Row 3: phase badge */}
            {showPhaseBadge && (
              <View style={styles.phaseBadgeRow}>
                <PhaseBadge
                  phaseNumber={today.phaseNumber!}
                  phaseName={today.phaseName!}
                />
              </View>
            )}
          </View>
        )}

        {renderContent()}
      </ScrollView>

      {showingSafety && today.safetyDetails && (
        <SafetyAdvisoryModal
          visible={showingSafety}
          details={today.safetyDetails}
          onAcknowledge={handleAcknowledgeSafety}
        />
      )}

      <UpdateWorkoutModal
        visible={showUpdateModal}
        loading={updateModalLoading}
        onClose={() => setShowUpdateModal(false)}
        onSelect={async (type: WorkoutUpdateType, note?: string) => {
          setUpdateModalLoading(true);
          await today.requestWorkoutUpdate(type, note);
          setUpdateModalLoading(false);
          setShowUpdateModal(false);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg.base,
  } as ViewStyle,

  scroll: {
    flex: 1,
  } as ViewStyle,

  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing.space8,
  } as ViewStyle,

  header: {
    paddingTop: Spacing.space4,
    marginBottom: Spacing.space5,
    gap: Spacing.space2,
  } as ViewStyle,

  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,

  dateMeta: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    color: Colors.text.muted,
    letterSpacing: 0.44, // 0.04em at 11px
    textTransform: 'uppercase',
  } as TextStyle,

  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  } as ViewStyle,

  streakDot: {
    width: 6,
    height: 6,
    backgroundColor: Colors.moss,
  } as ViewStyle,

  streakText: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    color: Colors.moss,
    letterSpacing: 0.44,
    textTransform: 'uppercase',
  } as TextStyle,

  screenHero: {
    fontFamily: FontFamily.black,
    fontSize: 40,
    lineHeight: 39, // 0.98 × 40
    letterSpacing: -1.4, // -0.035em at 40px
    color: Colors.text.primary,
    marginTop: 12,
  } as TextStyle,

  phaseBadgeRow: {
    marginTop: 10,
  } as ViewStyle,

  // ── Check-in ──────────────────────────────────────────────────────────────

  checkInContainer: {} as ViewStyle,

  sectionIntro: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.strong,
    paddingTop: 14,
    gap: 5,
  } as ViewStyle,

  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    lineHeight: 21.6, // 1.2 × 18
    letterSpacing: -0.18, // -0.01em at 18px
    color: Colors.text.primary,
  } as TextStyle,

  sectionSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21, // 1.5 × 14
    color: Colors.text.secondary,
  } as TextStyle,

  scaleDivider: {
    height: 1,
    backgroundColor: Colors.border.faint,
    marginVertical: 28,
  } as ViewStyle,

  checkInButton: {
    marginTop: 32,
  } as ViewStyle,

  // ── Rest day ──────────────────────────────────────────────────────────────

  restCard: {
    backgroundColor: Colors.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border.faint,
    borderLeftWidth: 4,
    borderLeftColor: Colors.semantic.warning,
    padding: Spacing.space5,
    gap: Spacing.space3,
  } as ViewStyle,

  restTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  } as TextStyle,

  restBody: {
    ...Typography.body,
    color: Colors.text.secondary,
  } as TextStyle,

  // ── Workout display ───────────────────────────────────────────────────────

  workoutContainer: {
    gap: Spacing.space5,
  } as ViewStyle,

  fallbackBanner: {
    backgroundColor: Colors.semantic.warning + '22',
    padding: Spacing.space3,
    borderLeftWidth: 3,
    borderLeftColor: Colors.semantic.warning,
  } as ViewStyle,

  fallbackBannerText: {
    ...Typography.bodySmall,
    color: Colors.semantic.warning,
  } as TextStyle,

  modifiedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.semantic.warning + '22',
    paddingVertical: 4,
    paddingHorizontal: Spacing.space3,
  } as ViewStyle,

  modifiedBadgeText: {
    ...Typography.label,
    color: Colors.semantic.warning,
  } as TextStyle,

  explanationText: {
    ...Typography.body,
    color: Colors.text.secondary,
  } as TextStyle,

  readMoreText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.primary,
    marginTop: 4,
  } as TextStyle,

  exerciseSection: {
    gap: 0,
  } as ViewStyle,

  exerciseSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingBottom: Spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.strong,
  } as ViewStyle,

  exerciseSectionEyebrow: {
    ...Typography.eyebrow,
    color: Colors.text.muted,
  } as TextStyle,

  exerciseCount: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    color: Colors.text.muted,
    letterSpacing: 0.4,
  } as TextStyle,

  exerciseList: {
    // rows have their own bottom borders
  } as ViewStyle,

  startButton: {
    marginTop: Spacing.space2,
  } as ViewStyle,

  updateWorkoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border.faint,
    paddingHorizontal: 18,
  } as ViewStyle,

  updateWorkoutText: {
    ...Typography.buttonLabel,
    color: Colors.text.secondary,
  } as TextStyle,

  updateWorkoutArrow: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 16,
    lineHeight: 16,
    color: Colors.text.secondary,
  } as TextStyle,

  // ── Error ─────────────────────────────────────────────────────────────────

  errorContainer: {
    gap: Spacing.space4,
    alignItems: 'center',
    paddingTop: Spacing.space6,
  } as ViewStyle,

  errorText: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  } as TextStyle,

  retryButton: {
    minWidth: 160,
  } as ViewStyle,
});

// ─── Workout completed styles ─────────────────────────────────────────────────

const completedStyles = StyleSheet.create({
  container: {
    gap: Spacing.space5,
  } as ViewStyle,

  dateMeta: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    color: Colors.text.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  } as TextStyle,

  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.space2,
    marginTop: -Spacing.space2,
  } as ViewStyle,

  eyebrowDot: {
    width: 10,
    height: 10,
    backgroundColor: Colors.moss,
  } as ViewStyle,

  eyebrowText: {
    ...Typography.eyebrow,
    color: Colors.moss,
  } as TextStyle,

  heroTitle: {
    fontFamily: FontFamily.black,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.2,
    color: Colors.text.primary,
    marginTop: -Spacing.space1,
  } as TextStyle,

  section: {
    gap: Spacing.space3,
  } as ViewStyle,

  sectionEyebrow: {
    ...Typography.eyebrow,
    color: Colors.text.muted,
  } as TextStyle,

  streakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  } as ViewStyle,

  streakCount: {
    ...Typography.stat,
    color: Colors.text.primary,
  } as TextStyle,

  streakUnit: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  } as TextStyle,

  streakBar: {
    flexDirection: 'row',
    gap: 3,
  } as ViewStyle,

  streakSegment: {
    flex: 1,
    height: 8,
  } as ViewStyle,

  statStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.bg.surface,
    borderWidth: 1,
    borderColor: Colors.border.faint,
    padding: Spacing.space4,
    alignItems: 'center',
  } as ViewStyle,

  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  } as ViewStyle,

  statValue: {
    ...Typography.stat,
    color: Colors.text.primary,
  } as TextStyle,

  statLabel: {
    ...Typography.eyebrow,
    color: Colors.text.muted,
    fontSize: 9,
  } as TextStyle,

  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border.faint,
  } as ViewStyle,

  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.space3,
    paddingVertical: Spacing.space2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.faint,
  } as ViewStyle,

  exerciseIndex: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    color: Colors.text.muted,
    width: 18,
    textAlign: 'center',
  } as TextStyle,

  exerciseMeta: {
    flex: 1,
    gap: 2,
  } as ViewStyle,

  exerciseName: {
    ...Typography.h3,
    color: Colors.text.primary,
  } as TextStyle,

  exerciseDetail: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  } as TextStyle,

  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.space3,
    paddingVertical: Spacing.space3,
    borderTopWidth: 1,
    borderTopColor: Colors.border.faint,
  } as ViewStyle,

  nextMeta: {
    flex: 1,
  } as ViewStyle,

  nextLabel: {
    ...Typography.label,
    color: Colors.text.muted,
  } as TextStyle,

  nextDate: {
    ...Typography.body,
    color: Colors.text.primary,
    marginTop: 2,
  } as TextStyle,

  reminderButton: {
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingVertical: Spacing.space3,
    alignItems: 'center',
  } as ViewStyle,

  reminderButtonText: {
    ...Typography.buttonLabel,
    color: Colors.text.secondary,
  } as TextStyle,
});
