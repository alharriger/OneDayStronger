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
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { getTodaySession, createSession } from '@/services/sessions';
import { submitCheckIn, getTodayCheckIn } from '@/services/checkins';
import { getWorkoutForSession, getMostRecentWorkout } from '@/services/workouts';
import { getPendingSafetyEvent } from '@/services/safetyEvents';
import { getActivePhase } from '@/services/plans';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TodayPhase =
  | 'loading'
  | 'check_in'
  | 'generating'
  | 'workout_ready'
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

export interface TodayState {
  phase: TodayPhase;
  sessionId: string | null;
  checkInId: string | null;
  workout: TodayWorkout | null;
  safetyEventId: string | null;
  safetyDetails: string | null;
  error: string | null;
  isRetryable: boolean;
  // Actions
  submitCheckIn: (painLevel: number, sorenessLevel: number) => Promise<void>;
  retryWorkoutGeneration: () => Promise<void>;
  acknowledgeSafety: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTodayWorkout(): TodayState {
  const { user } = useAuth();
  const [phase, setPhase] = useState<TodayPhase>('loading');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [checkInId, setCheckInId] = useState<string | null>(null);
  const [workout, setWorkout] = useState<TodayWorkout | null>(null);
  const [safetyEventId, setSafetyEventId] = useState<string | null>(null);
  const [safetyDetails, setSafetyDetails] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRetryable, setIsRetryable] = useState(false);

  const initializeToday = useCallback(async () => {
    if (!user) return;
    setPhase('loading');

    try {
      // Check for pending safety advisory from a prior session
      const pendingSafety = await getPendingSafetyEvent(user.id);
      if (pendingSafety) {
        setSafetyEventId(pendingSafety.id);
        setSafetyDetails(pendingSafety.details);
        setPhase('safety_advisory');
        return;
      }

      // Get or create today's session
      let session = await getTodaySession(user.id);
      if (!session) {
        // Need an active phase to create a session
        const activePhase = await getActivePhase(user.id);
        if (!activePhase) {
          setError('No active recovery plan found. Please complete onboarding.');
          setIsRetryable(false);
          setPhase('error');
          return;
        }

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

        // Check for existing workout
        const existingWorkout = await getWorkoutForSession(session.id);
        if (existingWorkout) {
          setWorkout({
            workoutId: existingWorkout.id,
            workout_type: existingWorkout.workout_type as TodayWorkout['workout_type'],
            plain_language_explanation: existingWorkout.plain_language_explanation,
            exercises: (existingWorkout.generated_workout_exercises ?? []).map((e: Record<string, unknown>) => ({
              exercise_name: e.exercise_name as string,
              sets: e.sets as number,
              reps: e.reps as string,
              load: e.load as string,
              tempo: e.tempo as string,
              rest_seconds: e.rest_seconds as number,
              notes: e.notes as string,
            })),
          });
          setPhase(existingWorkout.workout_type === 'rest_recommendation' ? 'rest_day' : 'workout_ready');
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
    }
  }, [user]);

  const generateWorkout = useCallback(async (sid: string, cid: string, uid: string) => {
    setPhase('generating');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-workout', {
        body: { sessionId: sid, checkInId: cid },
      });

      if (fnError || !data) {
        // Try to get fallback
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

      setWorkout({
        workoutId: data.workoutId,
        workout_type: data.workout_type,
        plain_language_explanation: data.plain_language_explanation,
        exercises: data.exercises ?? [],
        isFallback: data.isFallback ?? false,
        fallbackBanner: data.fallbackBanner,
      });

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

  return {
    phase,
    sessionId,
    checkInId,
    workout,
    safetyEventId,
    safetyDetails,
    error,
    isRetryable,
    submitCheckIn: handleSubmitCheckIn,
    retryWorkoutGeneration,
    acknowledgeSafety,
  };
}
