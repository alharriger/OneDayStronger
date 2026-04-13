/**
 * Fallback workout — returned when generate-workout fails twice.
 * Fetches yesterday's generated workout from the database.
 * Returns null if no prior workout exists (new user).
 */
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface FallbackWorkout {
  workout_type: 'standard' | 'modified' | 'rest_recommendation';
  plain_language_explanation: string;
  exercises: Array<{
    exercise_name: string;
    sets: number;
    reps: string;
    load: string;
    tempo: string;
    rest_seconds: number;
    notes: string;
  }>;
  isFallback: true;
  fallbackBanner: string;
}

export async function getFallbackWorkout(
  supabase: SupabaseClient,
  userId: string,
): Promise<FallbackWorkout | null> {
  // Find the most recent completed session with a generated workout
  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('scheduled_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) return null;

  const { data: workout } = await supabase
    .from('generated_workouts')
    .select('*, generated_workout_exercises(*)')
    .eq('session_id', session.id)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!workout) return null;

  const exercises = (workout.generated_workout_exercises ?? []).map((e: Record<string, unknown>) => ({
    exercise_name: e.exercise_name as string,
    sets: e.sets as number,
    reps: e.reps as string,
    load: e.load as string,
    tempo: e.tempo as string,
    rest_seconds: e.rest_seconds as number,
    notes: e.notes as string,
  }));

  return {
    workout_type: workout.workout_type as FallbackWorkout['workout_type'],
    plain_language_explanation: workout.plain_language_explanation as string,
    exercises,
    isFallback: true,
    fallbackBanner: "Using your last workout — we'll try again tomorrow.",
  };
}
