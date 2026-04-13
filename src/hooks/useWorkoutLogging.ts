/**
 * useWorkoutLogging — manages the post-workout logging flow.
 *
 * The user logs:
 * - Per-exercise actuals: sets completed, reps per set, weight per set
 * - Session-level: difficulty rating (1–10), pain during session (0–10), notes
 *
 * Safety guardrail: if pain_during_session > 5, the submit is blocked until
 * the user acknowledges a warning (high_pain_logging safety event inserted).
 *
 * On success: triggers evolve-plan edge function, then marks session completed.
 */
import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { saveWorkoutLog } from '@/services/workouts';
import { updateSession } from '@/services/sessions';
import { createSafetyEvent } from '@/services/safetyEvents';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { enqueueWorkoutLog } from '@/lib/localDb';
import type { Database } from '@/lib/database.types';

type ExerciseLogInsert = Database['public']['Tables']['exercise_logs']['Insert'];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExerciseActuals {
  exerciseId: string | null;
  exerciseName: string;
  setsCompleted: number;
  repsPerSet: number[];
  weightPerSet: (number | null)[];
  modifications: string;
}

export type LoggingPhase =
  | 'form'
  | 'high_pain_warning'
  | 'submitting'
  | 'success'
  | 'error';

export interface WorkoutLoggingState {
  phase: LoggingPhase;
  difficultyRating: number;
  painDuringSession: number;
  sessionNotes: string;
  exerciseActuals: ExerciseActuals[];
  error: string | null;
  isQueued: boolean; // true if the log was saved to the offline queue
  setDifficultyRating: (v: number) => void;
  setPainDuringSession: (v: number) => void;
  setSessionNotes: (v: string) => void;
  setExerciseActual: (index: number, actuals: ExerciseActuals) => void;
  submit: () => Promise<void>;
  acknowledgeHighPain: () => Promise<void>;
  dismissHighPain: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseWorkoutLoggingProps {
  sessionId: string;
  workoutId: string;
  exercises: Array<{
    exerciseId: string | null;
    exerciseName: string;
    prescribedSets: number;
  }>;
}

export function useWorkoutLogging({
  sessionId,
  workoutId,
  exercises,
}: UseWorkoutLoggingProps): WorkoutLoggingState {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [phase, setPhase] = useState<LoggingPhase>('form');
  const [difficultyRating, setDifficultyRating] = useState(5);
  const [painDuringSession, setPainDuringSession] = useState(0);
  const [sessionNotes, setSessionNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isQueued, setIsQueued] = useState(false);

  // Initialize exercise actuals from prescribed exercises
  const [exerciseActuals, setExerciseActuals] = useState<ExerciseActuals[]>(
    exercises.map((e) => ({
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseName,
      setsCompleted: e.prescribedSets,
      repsPerSet: Array(e.prescribedSets).fill(0),
      weightPerSet: Array(e.prescribedSets).fill(null),
      modifications: '',
    }))
  );

  const setExerciseActual = useCallback((index: number, actuals: ExerciseActuals) => {
    setExerciseActuals((prev) => {
      const next = [...prev];
      next[index] = actuals;
      return next;
    });
  }, []);

  const doSubmit = useCallback(async () => {
    if (!user) return;
    setPhase('submitting');
    setError(null);

    const exerciseLogInserts: ExerciseLogInsert[] = exerciseActuals.map((ea) => ({
      workout_log_id: '', // filled by saveWorkoutLog
      exercise_id: ea.exerciseId,
      exercise_name: ea.exerciseName,
      sets_completed: ea.setsCompleted,
      reps_per_set: ea.repsPerSet,
      weight_per_set: ea.weightPerSet.some((w) => w !== null) ? ea.weightPerSet : null,
      modifications: ea.modifications || null,
    }));

    // Offline: queue the log for sync on reconnect
    if (!isOnline) {
      try {
        await enqueueWorkoutLog({
          id: `${sessionId}-${Date.now()}`,
          session_id: sessionId,
          workout_id: workoutId,
          user_id: user.id,
          difficulty_rating: difficultyRating,
          pain_during_session: painDuringSession,
          session_notes: sessionNotes || null,
          exercise_logs_json: JSON.stringify(exerciseLogInserts),
          created_at: new Date().toISOString(),
        });
        setIsQueued(true);
        setPhase('success');
      } catch {
        setError('Could not save your workout log. Please try again when online.');
        setPhase('error');
      }
      return;
    }

    const { logId, error: logError } = await saveWorkoutLog(
      {
        user_id: user.id,
        session_id: sessionId,
        generated_workout_id: workoutId,
        difficulty_rating: difficultyRating,
        session_notes: sessionNotes || null,
        pain_during_session: painDuringSession,
      },
      exerciseLogInserts,
    );

    if (logError) {
      setError('Could not save your workout log. Please try again.');
      setPhase('error');
      return;
    }

    // Mark session completed
    await updateSession(sessionId, { status: 'completed' });

    // Trigger plan evolution (fire and forget — failure is silent per spec)
    supabase.functions.invoke('evolve-plan', {
      body: { sessionId, workoutLogId: logId },
    }).catch(() => {/* silently ignore — evolution retries on next log */});

    setPhase('success');
  }, [user, isOnline, sessionId, workoutId, difficultyRating, painDuringSession, sessionNotes, exerciseActuals]);

  const submit = useCallback(async () => {
    // Safety gate: pain > 5 during session requires acknowledgment
    if (painDuringSession > 5) {
      setPhase('high_pain_warning');
      return;
    }
    await doSubmit();
  }, [painDuringSession, doSubmit]);

  const acknowledgeHighPain = useCallback(async () => {
    if (!user) return;
    // Insert safety event for high-pain logging
    await createSafetyEvent({
      user_id: user.id,
      session_id: sessionId,
      trigger: 'high_pain_logging',
      pain_level_reported: painDuringSession,
      details: `User reported ${painDuringSession}/10 pain during session.`,
      professional_care_acknowledged: false,
    });
    await doSubmit();
  }, [user, sessionId, painDuringSession, doSubmit]);

  const dismissHighPain = useCallback(() => {
    setPhase('form');
  }, []);

  return {
    phase,
    difficultyRating,
    painDuringSession,
    sessionNotes,
    exerciseActuals,
    error,
    isQueued,
    setDifficultyRating,
    setPainDuringSession,
    setSessionNotes,
    setExerciseActual,
    submit,
    acknowledgeHighPain,
    dismissHighPain,
  };
}
