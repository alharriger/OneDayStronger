/**
 * Local SQLite database for offline support.
 *
 * Three concerns:
 * 1. Cached workout  — today's generated workout, served when offline
 * 2. Cached phase    — active plan phase + exercises, served when offline
 * 3. Workout log queue — logs submitted offline, flushed on reconnect
 *
 * Uses expo-sqlite v14+ async API.
 */
import * as SQLite from 'expo-sqlite';

// ─── Schema ───────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS cached_workout (
    workout_id                TEXT PRIMARY KEY,
    session_id                TEXT NOT NULL,
    workout_type              TEXT NOT NULL,
    plain_language_explanation TEXT NOT NULL,
    exercises_json            TEXT NOT NULL,
    cached_date               TEXT NOT NULL,
    is_fallback               INTEGER NOT NULL DEFAULT 0,
    fallback_banner           TEXT
  );

  CREATE TABLE IF NOT EXISTS cached_phase (
    phase_id              TEXT PRIMARY KEY,
    plan_id               TEXT NOT NULL,
    phase_number          INTEGER NOT NULL,
    name                  TEXT NOT NULL,
    description           TEXT,
    plain_language_summary TEXT
  );

  CREATE TABLE IF NOT EXISTS cached_phase_exercises (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    phase_id      TEXT NOT NULL,
    exercise_id   TEXT,
    exercise_name TEXT,
    prescribed_sets INTEGER,
    prescribed_reps TEXT,
    load_target   TEXT,
    tempo         TEXT,
    rest_seconds  INTEGER,
    order_index   INTEGER NOT NULL DEFAULT 0,
    notes         TEXT
  );

  CREATE TABLE IF NOT EXISTS pending_workout_logs (
    id                  TEXT PRIMARY KEY,
    session_id          TEXT NOT NULL,
    workout_id          TEXT NOT NULL,
    user_id             TEXT NOT NULL,
    difficulty_rating   INTEGER NOT NULL,
    pain_during_session INTEGER NOT NULL,
    session_notes       TEXT,
    exercise_logs_json  TEXT NOT NULL,
    created_at          TEXT NOT NULL
  );
`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CachedWorkout {
  workout_id: string;
  session_id: string;
  workout_type: 'standard' | 'modified' | 'rest_recommendation';
  plain_language_explanation: string;
  exercises_json: string;
  cached_date: string;
  is_fallback: number;
  fallback_banner: string | null;
}

export interface CachedPhase {
  phase_id: string;
  plan_id: string;
  phase_number: number;
  name: string;
  description: string | null;
  plain_language_summary: string | null;
}

export interface CachedPhaseExercise {
  phase_id: string;
  exercise_id: string | null;
  exercise_name: string | null;
  prescribed_sets: number | null;
  prescribed_reps: string | null;
  load_target: string | null;
  tempo: string | null;
  rest_seconds: number | null;
  order_index: number;
  notes: string | null;
}

export interface PendingWorkoutLog {
  id: string;
  session_id: string;
  workout_id: string;
  user_id: string;
  difficulty_rating: number;
  pain_during_session: number;
  session_notes: string | null;
  exercise_logs_json: string;
  created_at: string;
}

// ─── DB singleton ─────────────────────────────────────────────────────────────

let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_dbPromise) {
    _dbPromise = SQLite.openDatabaseAsync('one_day_stronger.db').then(async (db) => {
      await db.execAsync(SCHEMA_SQL);
      return db;
    }).catch((err) => {
      // Reset so the next call retries
      _dbPromise = null;
      throw err;
    });
  }
  return _dbPromise;
}

/** Exposed for tests to reset the singleton between test runs. */
export function resetDbSingleton(): void {
  _dbPromise = null;
}

// ─── Workout cache ────────────────────────────────────────────────────────────

export async function cacheWorkout(workout: CachedWorkout): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO cached_workout
      (workout_id, session_id, workout_type, plain_language_explanation,
       exercises_json, cached_date, is_fallback, fallback_banner)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      workout.workout_id,
      workout.session_id,
      workout.workout_type,
      workout.plain_language_explanation,
      workout.exercises_json,
      workout.cached_date,
      workout.is_fallback,
      workout.fallback_banner ?? null,
    ]
  );
}

export async function getCachedWorkoutForSession(
  sessionId: string
): Promise<CachedWorkout | null> {
  const db = await getDb();
  return db.getFirstAsync<CachedWorkout>(
    'SELECT * FROM cached_workout WHERE session_id = ?',
    [sessionId]
  );
}

export async function getCachedWorkoutForDate(
  date: string
): Promise<CachedWorkout | null> {
  const db = await getDb();
  return db.getFirstAsync<CachedWorkout>(
    'SELECT * FROM cached_workout WHERE cached_date = ? ORDER BY rowid DESC LIMIT 1',
    [date]
  );
}

// ─── Phase cache ──────────────────────────────────────────────────────────────

export async function cacheActivePhase(
  phase: CachedPhase,
  exercises: CachedPhaseExercise[]
): Promise<void> {
  const db = await getDb();
  // Replace the single cached phase row
  await db.runAsync('DELETE FROM cached_phase', []);
  await db.runAsync('DELETE FROM cached_phase_exercises', []);
  await db.runAsync(
    `INSERT INTO cached_phase
      (phase_id, plan_id, phase_number, name, description, plain_language_summary)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      phase.phase_id,
      phase.plan_id,
      phase.phase_number,
      phase.name,
      phase.description ?? null,
      phase.plain_language_summary ?? null,
    ]
  );
  for (const ex of exercises) {
    await db.runAsync(
      `INSERT INTO cached_phase_exercises
        (phase_id, exercise_id, exercise_name, prescribed_sets, prescribed_reps,
         load_target, tempo, rest_seconds, order_index, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ex.phase_id,
        ex.exercise_id ?? null,
        ex.exercise_name ?? null,
        ex.prescribed_sets ?? null,
        ex.prescribed_reps ?? null,
        ex.load_target ?? null,
        ex.tempo ?? null,
        ex.rest_seconds ?? null,
        ex.order_index,
        ex.notes ?? null,
      ]
    );
  }
}

export async function getCachedPhase(): Promise<{
  phase: CachedPhase;
  exercises: CachedPhaseExercise[];
} | null> {
  const db = await getDb();
  const phase = await db.getFirstAsync<CachedPhase>('SELECT * FROM cached_phase');
  if (!phase) return null;
  const exercises = await db.getAllAsync<CachedPhaseExercise>(
    'SELECT * FROM cached_phase_exercises WHERE phase_id = ? ORDER BY order_index ASC',
    [phase.phase_id]
  );
  return { phase, exercises };
}

// ─── Workout log queue ────────────────────────────────────────────────────────

export async function enqueueWorkoutLog(log: PendingWorkoutLog): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO pending_workout_logs
      (id, session_id, workout_id, user_id, difficulty_rating,
       pain_during_session, session_notes, exercise_logs_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.session_id,
      log.workout_id,
      log.user_id,
      log.difficulty_rating,
      log.pain_during_session,
      log.session_notes ?? null,
      log.exercise_logs_json,
      log.created_at,
    ]
  );
}

export async function getPendingLogs(): Promise<PendingWorkoutLog[]> {
  const db = await getDb();
  return db.getAllAsync<PendingWorkoutLog>(
    'SELECT * FROM pending_workout_logs ORDER BY created_at ASC'
  );
}

export async function removePendingLog(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM pending_workout_logs WHERE id = ?', [id]);
}
