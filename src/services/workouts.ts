import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type GeneratedWorkout = Database['public']['Tables']['generated_workouts']['Row'];
type GeneratedWorkoutExercise = Database['public']['Tables']['generated_workout_exercises']['Row'];
type WorkoutLog = Database['public']['Tables']['workout_logs']['Row'];
type WorkoutLogInsert = Database['public']['Tables']['workout_logs']['Insert'];
type ExerciseLogInsert = Database['public']['Tables']['exercise_logs']['Insert'];

export interface GeneratedWorkoutWithExercises extends GeneratedWorkout {
  generated_workout_exercises: GeneratedWorkoutExercise[];
}

export async function getWorkoutForSession(
  sessionId: string
): Promise<GeneratedWorkoutWithExercises | null> {
  const { data, error } = await supabase
    .from('generated_workouts')
    .select(`
      *,
      generated_workout_exercises (*)
    `)
    .eq('session_id', sessionId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data as GeneratedWorkoutWithExercises;
}

export async function getMostRecentWorkout(
  userId: string
): Promise<GeneratedWorkoutWithExercises | null> {
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('scheduled_date', { ascending: false })
    .limit(1)
    .single();

  if (sessionError || !session) return null;
  return getWorkoutForSession(session.id);
}

export async function saveWorkoutLog(
  log: WorkoutLogInsert,
  exerciseLogs: ExerciseLogInsert[]
): Promise<{ logId: string | null; error: string | null }> {
  const { data: inserted, error } = await supabase
    .from('workout_logs')
    .insert(log)
    .select('id')
    .single();

  if (error) return { logId: null, error: error.message };

  if (exerciseLogs.length > 0) {
    const logsWithId = exerciseLogs.map((el) => ({
      ...el,
      workout_log_id: inserted.id,
    }));

    const { error: elError } = await supabase
      .from('exercise_logs')
      .insert(logsWithId);

    if (elError) return { logId: inserted.id, error: elError.message };
  }

  return { logId: inserted.id, error: null };
}

export async function getWorkoutLog(sessionId: string): Promise<WorkoutLog | null> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('session_id', sessionId)
    .limit(1)
    .single();

  if (error) return null;
  return data;
}
