/**
 * useTodayWorkout — orchestrates the Today screen data flow:
 *
 *   idle → check-in required → generating workout → workout ready
 *                                                  → rest day
 *                                                  → safety advisory
 *                                                  → error (retryable)
 *
 * The hook drives all async state; the Today screen is a pure render
 * function over the returned state.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { getTodaySession, createSession } from '@/services/sessions';
import { submitCheckIn, getTodayCheckIn } from '@/services/checkins';
import { getWorkoutForSession, getMostRecentWorkout, getWorkoutLogWithExercises } from '@/services/workouts';
import { getPendingSafetyEvent } from '@/services/safetyEvents';
import { getActivePhase, getActivePlan } from '@/services/plans';
import { getCompletionHistory } from '@/services/sessions';
import { onPlanChanged } from '@/lib/planEvents';
import {
  cacheWorkout,
  getCachedWorkoutForSession,
  getCachedWorkoutForDate,
  clearCachedWorkoutForDate,
  cacheActivePhase,
  type CachedPhaseExercise,
} from '@/lib/localDb';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TodayPhase =
  | 'loading'
  | 'check_in'
  | 'generating'
  | 'workout_ready'
  | 'workout_completed'
  | 'rest_day'
  | 'safety_advisory'
  | 'error';

export interface WorkoutExercise {
  exercise_name: string;
  sets: number;
  reps: string;
  load: string;
  tempo: string;
  rest_seconds: number;
  notes: string;
}

export interface TodayWorkout {
  workoutId: string;
  workout_type: 'standard' | 'modified' | 'rest_recommendation';
  plain_language_explanation: string;
  exercises: WorkoutExercise[];
  isFallback?: boolean;
  fallbackBanner?: string;
}

export interface CompletedExerciseRow {
  name: string;
  setsCompleted: number | null;
  totalReps: number | null;
  prescribedSets: number | null;
  prescribedReps: string | null;
}

export interface CompletedSessionData {
  exercises: CompletedExerciseRow[];
  totalReps: number;
  durationMinutes: number | null;
  painAtCheckin: number | null;
  streakCount: number;
  recentCompletedDates: string[];
  nextWorkoutDate: string;
}

export interface TodayState {
  phase: TodayPhase;
  sessionId: string | null;
  checkInId: string | null;
  workout: TodayWorkout | null;
  completedData: CompletedSessionData | null;
  safetyEventId: string | null;
  safetyDetails: string | null;
  error: string | null;
  isRetryable: boolean;
  /** Consecutive completed-day streak (available after first load). */
  streakCount: number | null;
  /** Active phase number for PhaseBadge display. */
  phaseNumber: number | null;
  /** Active phase name for PhaseBadge display. */
  phaseName: string | null;
  // Actions
  submitCheckIn: (painLevel: number, sorenessLevel: number) => Promise<void>;
  retryWorkoutGeneration: () => Promise<void>;
  acknowledgeSafety: () => void;
  requestWorkoutUpdate: (type: 'advance' | 'phase_back' | 'other', note?: string) => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts a rep count from a prescription string for fallback total-reps
 * estimation when actual logs are unavailable.
 * "12" → 12, "8-12" → 12 (upper bound), "8 each side" → 8
 * Returns null for time-based strings like "30s" or "30 seconds".
 */
function parseRepsString(repsStr: string | null): number | null {
  if (!repsStr) return null;
  // Time-based: skip
  if (/\d+\s*(s|sec|seconds|min|minutes)/i.test(repsStr)) return null;
  // "X-Y" range → upper bound
  const range = repsStr.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) return parseInt(range[2], 10);
  // Simple number (possibly followed by text like "each side")
  const simple = repsStr.match(/^(\d+)/);
  if (simple) return parseInt(simple[1], 10);
  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTodayWorkout(): TodayState {
  const { user } = useAuth();
  const [phase, setPhase] = useState<TodayPhase>('loading');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [checkInId, setCheckInId] = useState<string | null>(null);
  const [workout, setWorkout] = useState<TodayWorkout | null>(null);
  const [completedData, setCompletedData] = useState<CompletedSessionData | null>(null);
  const [safetyEventId, setSafetyEventId] = useState<string | null>(null);
  const [safetyDetails, setSafetyDetails] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRetryable, setIsRetryable] = useState(false);
  const [streakCount, setStreakCount] = useState<number | null>(null);
  const [phaseNumber, setPhaseNumber] = useState<number | null>(null);
  const [phaseName, setPhaseName] = useState<string | null>(null);

  // Set to true when a plan change fires while the Today tab may not be focused.
  // useFocusEffect reads and clears it on the next focus to guarantee a reinit.
  const planChangedRef = useRef(false);
  // Guards against concurrent initializeToday calls (e.g. onPlanChanged fires
  // immediately while useFocusEffect also fires when the tab regains focus).
  const isInitializingRef = useRef(false);

  const resetState = useCallback(() => {
    isInitializingRef.current = false;
    setPhase('loading');
    setWorkout(null);
    setCompletedData(null);
    setSessionId(null);
    setCheckInId(null);
    setError(null);
    setIsRetryable(false);
  }, []);

  /**
   * Fetches all data needed to render the WorkoutCompletedView.
   * Called whenever initializeToday routes to workout_completed.
   */
  const loadCompletedData = useCallback(async (
    sid: string,
    uid: string,
    painAtCheckin: number | null,
    checkInTime: string | null,
    workoutExercises: WorkoutExercise[],
  ) => {
    const [logResult, history] = await Promise.all([
      getWorkoutLogWithExercises(sid),
      getCompletionHistory(uid),
    ]);

    // Duration: check-in time → workout completion time (null if > 3 hours or missing)
    let durationMinutes: number | null = null;
    if (logResult?.completed_at && checkInTime) {
      const diffMs = new Date(logResult.completed_at).getTime() - new Date(checkInTime).getTime();
      const diffMin = diffMs / 60_000;
      if (diffMin > 0 && diffMin <= 180) durationMinutes = Math.round(diffMin);
    }

    // Build exercise rows: match exercise_logs to prescribed exercises by name
    const exerciseLogMap = new Map(
      (logResult?.exercise_logs ?? []).map((el) => [el.exercise_name, el])
    );

    const exercises: CompletedExerciseRow[] = workoutExercises.map((prescribed) => {
      const logged = exerciseLogMap.get(prescribed.exercise_name);
      const repsArray = (logged?.reps_per_set ?? []) as number[];
      const loggedTotalReps = repsArray.length > 0 ? repsArray.reduce((a, b) => a + b, 0) : null;

      // Fallback: estimate reps from the prescription string (e.g. "12", "8-12")
      const estimatedPerSet = parseRepsString(prescribed.reps);
      const estimatedTotalReps =
        loggedTotalReps == null && prescribed.sets && estimatedPerSet != null
          ? prescribed.sets * estimatedPerSet
          : null;

      return {
        name: prescribed.exercise_name,
        setsCompleted: logged?.sets_completed ?? null,
        totalReps: loggedTotalReps ?? estimatedTotalReps,
        prescribedSets: prescribed.sets,
        prescribedReps: prescribed.reps,
      };
    });

    const totalReps = exercises.reduce((sum, ex) => sum + (ex.totalReps ?? 0), 0);

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 2);
    const nextWorkoutDate = nextDate.toISOString().split('T')[0];

    setCompletedData({
      exercises,
      totalReps,
      durationMinutes,
      painAtCheckin,
      streakCount: history.streakCount,
      recentCompletedDates: history.recentCompletedDates,
      nextWorkoutDate,
    });
  }, []);

  const initializeToday = useCallback(async () => {
    if (!user) return;
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;
    setPhase('loading');

    try {
      // Fetch safety check, streak, and phase meta in parallel — no serial latency added.
      const [pendingSafety, history, activePhase] = await Promise.all([
        getPendingSafetyEvent(user.id),
        getCompletionHistory(user.id),
        getActivePhase(user.id),
      ]);

      setStreakCount(history.streakCount);
      if (activePhase) {
        setPhaseNumber(activePhase.phase_number);
        setPhaseName(activePhase.name);
      }

      if (pendingSafety) {
        setSafetyEventId(pendingSafety.id);
        setSafetyDetails(pendingSafety.details);
        setPhase('safety_advisory');
        return;
      }

      // Get or create today's session
      let session = await getTodaySession(user.id);
      if (!session) {
        // Reuse already-fetched activePhase — no duplicate DB call needed.
        if (!activePhase) {
          setError('No active recovery plan found. Please complete onboarding.');
          setIsRetryable(false);
          setPhase('error');
          return;
        }

        // Cache the active phase + exercises for offline use
        const phaseExerciseCache: CachedPhaseExercise[] = activePhase.phase_exercises.map((pe) => ({
          phase_id: activePhase.id,
          exercise_id: pe.exercise_id ?? null,
          exercise_name: pe.exercises?.name ?? null,
          prescribed_sets: pe.prescribed_sets ?? null,
          prescribed_reps: pe.prescribed_reps ?? null,
          load_target: pe.load_target ?? null,
          tempo: pe.tempo ?? null,
          rest_seconds: pe.rest_seconds ?? null,
          order_index: pe.order_index,
          notes: pe.notes ?? null,
        }));
        cacheActivePhase(
          {
            phase_id: activePhase.id,
            plan_id: activePhase.plan_id,
            phase_number: activePhase.phase_number,
            name: activePhase.name,
            description: activePhase.description ?? null,
            plain_language_summary: activePhase.plain_language_summary ?? null,
          },
          phaseExerciseCache
        ).catch(() => {/* cache failure is non-critical */});

        const result = await createSession({
          user_id: user.id,
          plan_phase_id: activePhase.id,
          scheduled_date: new Date().toISOString().split('T')[0],
          session_type: 'training',
          status: 'scheduled',
        });

        if (result.error || !result.session) {
          setError('Could not create today\'s session. Please try again.');
          setIsRetryable(true);
          setPhase('error');
          return;
        }
        session = result.session;
      }

      setSessionId(session.id);

      // Check for existing check-in
      const existingCheckIn = await getTodayCheckIn(user.id);
      if (existingCheckIn) {
        setCheckInId(existingCheckIn.id);

        // Check for existing workout (server first, then local cache)
        const existingWorkout = await getWorkoutForSession(session.id);
        if (existingWorkout) {
          const exercises = (existingWorkout.generated_workout_exercises ?? []).map((e: Record<string, unknown>) => ({
            exercise_name: e.exercise_name as string,
            sets: e.sets as number,
            reps: e.reps as string,
            load: e.load as string,
            tempo: e.tempo as string,
            rest_seconds: e.rest_seconds as number,
            notes: e.notes as string,
          }));
          setWorkout({
            workoutId: existingWorkout.id,
            workout_type: existingWorkout.workout_type as TodayWorkout['workout_type'],
            plain_language_explanation: existingWorkout.plain_language_explanation,
            exercises,
          });
          // Refresh local cache with latest server data
          cacheWorkout({
            workout_id: existingWorkout.id,
            session_id: session.id,
            workout_type: existingWorkout.workout_type as TodayWorkout['workout_type'],
            plain_language_explanation: existingWorkout.plain_language_explanation,
            exercises_json: JSON.stringify(exercises),
            cached_date: new Date().toISOString().split('T')[0],
            is_fallback: 0,
            fallback_banner: null,
          }).catch(() => {});
          if (session.status === 'completed') {
            setPhase('workout_completed');
            loadCompletedData(session.id, user.id, existingCheckIn.pain_level, existingCheckIn.checked_in_at, exercises).catch(() => {});
          } else {
            setPhase(existingWorkout.workout_type === 'rest_recommendation' ? 'rest_day' : 'workout_ready');
          }
          return;
        }

        // No server workout — check local cache before generating
        const today = new Date().toISOString().split('T')[0];
        const cachedForToday = await getCachedWorkoutForSession(session.id)
          ?? await getCachedWorkoutForDate(today).catch(() => null);
        if (cachedForToday) {
          const cachedExercises = JSON.parse(cachedForToday.exercises_json) as WorkoutExercise[];
          setWorkout({
            workoutId: cachedForToday.workout_id,
            workout_type: cachedForToday.workout_type,
            plain_language_explanation: cachedForToday.plain_language_explanation,
            exercises: cachedExercises,
            isFallback: cachedForToday.is_fallback === 1,
            fallbackBanner: cachedForToday.fallback_banner ?? undefined,
          });
          if (session.status === 'completed') {
            setPhase('workout_completed');
            loadCompletedData(session.id, user.id, existingCheckIn.pain_level, existingCheckIn.checked_in_at, cachedExercises).catch(() => {});
          } else {
            setPhase(cachedForToday.workout_type === 'rest_recommendation' ? 'rest_day' : 'workout_ready');
          }
          return;
        }

        // Have check-in but no workout yet — generate it
        await generateWorkout(session.id, existingCheckIn.id, user.id);
        return;
      }

      // No check-in yet
      setPhase('check_in');
    } catch {
      setError('Something went wrong loading today\'s data.');
      setIsRetryable(true);
      setPhase('error');
    } finally {
      isInitializingRef.current = false;
    }
  }, [user]);

  const generateWorkout = useCallback(async (
    sid: string,
    cid: string,
    uid: string,
    options?: {
      overridePhaseId?: string;
      overrideNote?: string;
      overrideType?: 'advance' | 'phase_back' | 'other';
    },
  ) => {
    setPhase('generating');
    try {
      const now = new Date();
      const h = now.getHours();
      const { data, error: fnError } = await supabase.functions.invoke('generate-workout', {
        body: {
          sessionId: sid,
          checkInId: cid,
          isoDate: now.toISOString().split('T')[0],
          dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
          timeOfDay: h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening',
          ...options,
        },
      });

      if (fnError || !data) {
        // Try local cache first (today's cached workout for this session)
        const today = new Date().toISOString().split('T')[0];
        const cachedLocal = await getCachedWorkoutForSession(sid)
          .catch(() => null) ?? await getCachedWorkoutForDate(today).catch(() => null);
        if (cachedLocal) {
          setWorkout({
            workoutId: cachedLocal.workout_id,
            workout_type: cachedLocal.workout_type,
            plain_language_explanation: cachedLocal.plain_language_explanation,
            exercises: JSON.parse(cachedLocal.exercises_json) as WorkoutExercise[],
            isFallback: true,
            fallbackBanner: "Using your cached workout — we'll generate a new one when you're back online.",
          });
          setPhase(cachedLocal.workout_type === 'rest_recommendation' ? 'rest_day' : 'workout_ready');
          return;
        }

        // Fall back to most recent server workout
        const fallback = await getMostRecentWorkout(uid);
        if (fallback) {
          setWorkout({
            workoutId: fallback.id,
            workout_type: fallback.workout_type as TodayWorkout['workout_type'],
            plain_language_explanation: fallback.plain_language_explanation,
            exercises: [],
            isFallback: true,
            fallbackBanner: "Using your last workout — we'll try again tomorrow.",
          });
          setPhase('workout_ready');
          return;
        }

        setError('We had trouble generating your workout. Please try again.');
        setIsRetryable(true);
        setPhase('error');
        return;
      }

      // Safety advisory from workout generation
      if (data.safetyFlagged) {
        setSafetyEventId(data.safetyEventId ?? null);
        setSafetyDetails('Your pain level today is high. Rest is recommended. If pain persists, please seek professional care.');
        setPhase('safety_advisory');
        return;
      }

      const exercises: WorkoutExercise[] = data.exercises ?? [];
      setWorkout({
        workoutId: data.workoutId,
        workout_type: data.workout_type,
        plain_language_explanation: data.plain_language_explanation,
        exercises,
        isFallback: data.isFallback ?? false,
        fallbackBanner: data.fallbackBanner,
      });

      // Write to local cache for offline use
      cacheWorkout({
        workout_id: data.workoutId,
        session_id: sid,
        workout_type: data.workout_type,
        plain_language_explanation: data.plain_language_explanation,
        exercises_json: JSON.stringify(exercises),
        cached_date: new Date().toISOString().split('T')[0],
        is_fallback: data.isFallback ? 1 : 0,
        fallback_banner: data.fallbackBanner ?? null,
      }).catch(() => {/* cache failure is non-critical */});

      setPhase(data.workout_type === 'rest_recommendation' ? 'rest_day' : 'workout_ready');
    } catch {
      setError('Something went wrong generating your workout.');
      setIsRetryable(true);
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    initializeToday();
  }, [initializeToday]);

  // When the plan changes (revise-plan, phase jump, workout logged):
  // - Clear the local cache so stale data isn't served on next init
  // - Mark the dirty flag — useFocusEffect owns the actual reinit
  //   (avoids the race where both this handler AND useFocusEffect call
  //    initializeToday concurrently when the user navigates to Today)
  useEffect(() => {
    return onPlanChanged(() => {
      const today = new Date().toISOString().split('T')[0];
      clearCachedWorkoutForDate(today).catch(() => {/* non-critical */});
      planChangedRef.current = true;
    });
  }, []);

  // Single owner of reinit after a plan change: fires when Today tab gains focus.
  // resetState clears isInitializingRef so the new initializeToday can proceed.
  useFocusEffect(
    useCallback(() => {
      if (planChangedRef.current) {
        planChangedRef.current = false;
        resetState();
        initializeToday();
      }
    }, [initializeToday, resetState])
  );

  const handleSubmitCheckIn = useCallback(async (painLevel: number, sorenessLevel: number) => {
    if (!user || !sessionId) return;
    setPhase('generating');

    const result = await submitCheckIn({
      user_id: user.id,
      session_id: sessionId,
      pain_level: painLevel,
      soreness_level: sorenessLevel,
      triggered_by: 'inline',
    });

    if (result.error || !result.checkIn) {
      setError('Could not save your check-in. Please try again.');
      setIsRetryable(true);
      setPhase('error');
      return;
    }

    setCheckInId(result.checkIn.id);
    await generateWorkout(sessionId, result.checkIn.id, user.id);
  }, [user, sessionId, generateWorkout]);

  const retryWorkoutGeneration = useCallback(async () => {
    if (!sessionId || !checkInId || !user) return;
    await generateWorkout(sessionId, checkInId, user.id);
  }, [sessionId, checkInId, user, generateWorkout]);

  const acknowledgeSafety = useCallback(() => {
    // The actual DB write is handled by the Profile/SafetyAdvisoryModal;
    // here we just clear the advisory state so the user can proceed.
    setSafetyEventId(null);
    setSafetyDetails(null);
    setPhase('check_in');
  }, []);

  /**
   * Regenerates today's workout with one of three override types:
   *  - 'advance'    : uses next-phase exercises (no permanent phase change)
   *  - 'phase_back' : uses current-phase exercises at conservative end of ranges
   *  - 'other'      : appends a free-text user note to the generation prompt
   */
  const requestWorkoutUpdate = useCallback(async (
    type: 'advance' | 'phase_back' | 'other',
    note?: string,
  ) => {
    if (!user || !sessionId || !checkInId) return;

    let overridePhaseId: string | undefined;

    if (type === 'advance') {
      const plan = await getActivePlan(user.id);
      if (plan) {
        const sorted = [...plan.plan_phases].sort((a, b) => a.phase_number - b.phase_number);
        const activeIdx = sorted.findIndex((p) => p.status === 'active');
        const nextPhase = activeIdx >= 0 ? sorted[activeIdx + 1] : null;
        if (nextPhase) {
          overridePhaseId = nextPhase.id;
        }
        // If no next phase (user is on the last phase), fall through without override
      }
    }

    // Clear today's cache so the new workout is served on next init
    const today = new Date().toISOString().split('T')[0];
    await clearCachedWorkoutForDate(today).catch(() => {/* non-critical */});

    await generateWorkout(sessionId, checkInId, user.id, {
      overridePhaseId,
      overrideNote: note,
      overrideType: type,
    });
  }, [user, sessionId, checkInId, generateWorkout]);

  return {
    phase,
    sessionId,
    checkInId,
    workout,
    completedData,
    safetyEventId,
    safetyDetails,
    error,
    isRetryable,
    streakCount,
    phaseNumber,
    phaseName,
    submitCheckIn: handleSubmitCheckIn,
    retryWorkoutGeneration,
    acknowledgeSafety,
    requestWorkoutUpdate,
  };
}
