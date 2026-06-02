/**
 * Pure TypeScript plan evolution evaluator.
 * No Deno-specific imports — this module is unit-tested in Jest.
 *
 * Runs after every workout log to decide whether the user should progress to
 * the next phase, regress to the previous phase, hold steady, or continue
 * accumulating data before evaluating.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type EvolveDecision = 'progress' | 'regress' | 'hold' | 'continue';

export interface ProgressionCriteria {
  pain_threshold: number;       // max avg pain to progress (0–4)
  load_tolerance_pct: number;   // min % of prescribed sets completed (50–100)
  consistency_pct: number;      // min session completion rate % (60–100)
  window_days: number;          // evaluation window in days
}

export interface RegressionCriteria {
  pain_consecutive_sessions: number;  // consecutive high-pain sessions before regress (2–4)
  missed_sessions_window: number;     // missed sessions in window before regress (1–10)
}

export interface CheckInRecord {
  pain_level: number;
  checked_in_at: string; // ISO timestamp
}

export interface SessionRecord {
  status: 'scheduled' | 'completed' | 'skipped' | 'rest_day';
  scheduled_date: string; // ISO date string
}

export interface ExerciseLogRecord {
  sets_completed: number | null;
}

export interface PhaseExerciseRecord {
  prescribed_sets: number | null;
}

export interface WorkoutLogRecord {
  difficulty_rating: number | null;
  pain_during_session: number | null;
  completed_at: string; // ISO timestamp
}

export interface EvolveInput {
  windowStartDate: string; // ISO date — filter check-ins and sessions at or after this date
  progressionCriteria: ProgressionCriteria;
  regressionCriteria: RegressionCriteria;
  recentCheckIns: CheckInRecord[];
  sessions: SessionRecord[];
  exerciseLogs: ExerciseLogRecord[];
  phaseExercises: PhaseExerciseRecord[];
  recentWorkoutLogs: WorkoutLogRecord[];
  /** RPE threshold above which load is considered excessive (default: 8) */
  difficultyHoldThreshold?: number;
  /** Gap in days between sessions that registers as a deconditioning regression signal (default: 7) */
  sessionGapRegressionDays?: number;
}

export interface EvolveMetrics {
  avgPain: number;
  loadTolerancePct: number;
  consistencyPct: number;
  consecutiveHighPainSessions: number;
  missedSessionsInWindow: number;
  completedSessionsInWindow: number;
  avgDifficulty: number;
  maxSessionGapDays: number;
}

export interface EvolveResult {
  decision: EvolveDecision;
  rationale: string;
  metrics: EvolveMetrics;
}

// ─── Evaluator ────────────────────────────────────────────────────────────────

export function evaluatePlanProgress(input: EvolveInput): EvolveResult {
  const {
    windowStartDate, progressionCriteria, regressionCriteria,
    recentCheckIns, sessions, exerciseLogs, phaseExercises,
    recentWorkoutLogs,
    difficultyHoldThreshold = 8,
    sessionGapRegressionDays = 7,
  } = input;
  const { pain_threshold, load_tolerance_pct, consistency_pct, window_days } = progressionCriteria;
  const { pain_consecutive_sessions, missed_sessions_window } = regressionCriteria;

  // Filter to window
  const checkInsInWindow = recentCheckIns.filter((c) => c.checked_in_at >= windowStartDate);
  const sessionsInWindow = sessions.filter((s) => s.scheduled_date >= windowStartDate);

  // Only count non-rest sessions for performance metrics
  const trainingSessions = sessionsInWindow.filter((s) => s.status !== 'rest_day');
  const completedSessions = trainingSessions.filter((s) => s.status === 'completed');
  const skippedSessions = trainingSessions.filter((s) => s.status === 'skipped');

  // ── Minimum data check ─────────────────────────────────────────────────────
  // Need at least one session per week of the window before evaluating
  const minSessionsRequired = Math.max(1, Math.floor(window_days / 7));
  if (completedSessions.length < minSessionsRequired) {
    return {
      decision: 'continue',
      rationale: `Only ${completedSessions.length} completed session(s) in the ${window_days}-day window (${minSessionsRequired} required to evaluate).`,
      metrics: buildMetrics(0, 100, 100, 0, skippedSessions.length, completedSessions.length),
    };
  }

  // ── Average pain ───────────────────────────────────────────────────────────
  const avgPain = checkInsInWindow.length > 0
    ? checkInsInWindow.reduce((sum, c) => sum + c.pain_level, 0) / checkInsInWindow.length
    : 0;

  // ── Load tolerance ─────────────────────────────────────────────────────────
  // Aggregate: total sets completed / total sets expected per session
  // If no exercise logs, assume 100% (user may not be logging per-exercise)
  let loadTolerancePct = 100;
  if (exerciseLogs.length > 0 && phaseExercises.length > 0 && completedSessions.length > 0) {
    const totalSetsDone = exerciseLogs.reduce((sum, log) => sum + (log.sets_completed ?? 0), 0);
    const setsExpectedPerSession = phaseExercises.reduce((sum, ex) => sum + (ex.prescribed_sets ?? 0), 0);
    const totalSetsExpected = setsExpectedPerSession * completedSessions.length;
    loadTolerancePct = totalSetsExpected > 0
      ? Math.round((totalSetsDone / totalSetsExpected) * 100)
      : 100;
  }

  // ── Consistency ────────────────────────────────────────────────────────────
  // completed / (completed + skipped); scheduled sessions not yet due don't count
  const totalCountable = completedSessions.length + skippedSessions.length;
  const consistencyPct = totalCountable > 0
    ? Math.round((completedSessions.length / totalCountable) * 100)
    : 100;

  // ── Consecutive high-pain sessions ────────────────────────────────────────
  // Walk sessions most-recent-first, counting consecutive pain > threshold
  const sortedSessions = [...sessionsInWindow].sort(
    (a, b) => b.scheduled_date.localeCompare(a.scheduled_date)
  );
  const sortedCheckIns = [...checkInsInWindow].sort(
    (a, b) => b.checked_in_at.localeCompare(a.checked_in_at)
  );

  let consecutiveHighPainSessions = 0;
  for (const session of sortedSessions) {
    if (session.status !== 'completed') continue;
    // Find a check-in on the same date
    const sessionDate = session.scheduled_date;
    const matchingCheckIn = sortedCheckIns.find((c) => c.checked_in_at.startsWith(sessionDate));
    if (!matchingCheckIn) break; // no check-in data — stop counting
    if (matchingCheckIn.pain_level > pain_threshold) {
      consecutiveHighPainSessions++;
    } else {
      break; // streak ends
    }
  }

  const missedSessionsInWindow = skippedSessions.length;

  // ── Difficulty (RPE) signal ────────────────────────────────────────────────
  // Average difficulty across recent workout logs. A consistently high RPE (≥ threshold)
  // indicates the current phase load exceeds the user's capacity — treat as hold.
  const logsWithDifficulty = recentWorkoutLogs.filter((l) => l.difficulty_rating !== null);
  const avgDifficulty = logsWithDifficulty.length > 0
    ? logsWithDifficulty.reduce((sum, l) => sum + (l.difficulty_rating ?? 0), 0) / logsWithDifficulty.length
    : 0;
  const difficultyHoldTriggered = logsWithDifficulty.length >= 2 && avgDifficulty >= difficultyHoldThreshold;

  // ── Session gap signal ─────────────────────────────────────────────────────
  // Find the largest gap between consecutive completed sessions using completed_at.
  // A gap ≥ threshold indicates a deconditioning risk even if no sessions were "skipped".
  const sortedCompletedLogs = [...recentWorkoutLogs]
    .filter((l) => l.completed_at)
    .sort((a, b) => a.completed_at.localeCompare(b.completed_at));
  let maxSessionGapDays = 0;
  for (let i = 1; i < sortedCompletedLogs.length; i++) {
    const prev = new Date(sortedCompletedLogs[i - 1].completed_at).getTime();
    const curr = new Date(sortedCompletedLogs[i].completed_at).getTime();
    const gapDays = (curr - prev) / (1000 * 60 * 60 * 24);
    if (gapDays > maxSessionGapDays) maxSessionGapDays = gapDays;
  }
  const gapRegressionTriggered = maxSessionGapDays >= sessionGapRegressionDays;

  const metrics: EvolveMetrics = buildMetrics(
    avgPain,
    loadTolerancePct,
    consistencyPct,
    consecutiveHighPainSessions,
    missedSessionsInWindow,
    completedSessions.length,
    avgDifficulty,
    maxSessionGapDays,
  );

  // ── Regression check (safety first) ───────────────────────────────────────
  const painRegressionTriggered = consecutiveHighPainSessions >= pain_consecutive_sessions;
  const missedRegressionTriggered = missedSessionsInWindow >= missed_sessions_window;

  if (painRegressionTriggered || missedRegressionTriggered || gapRegressionTriggered) {
    let reason: string;
    if (painRegressionTriggered) {
      reason = `Pain exceeded threshold for ${consecutiveHighPainSessions} consecutive session(s) (limit: ${pain_consecutive_sessions}).`;
    } else if (gapRegressionTriggered) {
      reason = `Session gap of ${Math.round(maxSessionGapDays)} days detected — deconditioning risk. Stepping back to rebuild load tolerance.`;
    } else {
      reason = `${missedSessionsInWindow} session(s) skipped in window (limit: ${missed_sessions_window}).`;
    }
    return {
      decision: 'regress',
      rationale: reason,
      metrics,
    };
  }

  // ── Progression check ──────────────────────────────────────────────────────
  const painMet = avgPain <= pain_threshold;
  const loadMet = loadTolerancePct >= load_tolerance_pct;
  const consistencyMet = consistencyPct >= consistency_pct;

  // High difficulty overrides progression — hold even if other criteria are met.
  if (difficultyHoldTriggered) {
    return {
      decision: 'hold',
      rationale: `Average session difficulty ${avgDifficulty.toFixed(1)}/10 ≥ ${difficultyHoldThreshold} — current load exceeds capacity. Holding phase until RPE decreases.`,
      metrics,
    };
  }

  if (painMet && loadMet && consistencyMet) {
    return {
      decision: 'progress',
      rationale: `All criteria met over ${window_days} days: avg pain ${avgPain.toFixed(1)} ≤ ${pain_threshold}, load ${loadTolerancePct}% ≥ ${load_tolerance_pct}%, consistency ${consistencyPct}% ≥ ${consistency_pct}%.`,
      metrics,
    };
  }

  // ── Hold ───────────────────────────────────────────────────────────────────
  const unmet: string[] = [];
  if (!painMet) unmet.push(`pain avg ${avgPain.toFixed(1)} > threshold ${pain_threshold}`);
  if (!loadMet) unmet.push(`load ${loadTolerancePct}% < target ${load_tolerance_pct}%`);
  if (!consistencyMet) unmet.push(`consistency ${consistencyPct}% < target ${consistency_pct}%`);

  return {
    decision: 'hold',
    rationale: `Holding current phase — criteria not fully met: ${unmet.join('; ')}.`,
    metrics,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMetrics(
  avgPain: number,
  loadTolerancePct: number,
  consistencyPct: number,
  consecutiveHighPainSessions: number,
  missedSessionsInWindow: number,
  completedSessionsInWindow: number,
  avgDifficulty: number,
  maxSessionGapDays: number,
): EvolveMetrics {
  return {
    avgPain,
    loadTolerancePct,
    consistencyPct,
    consecutiveHighPainSessions,
    missedSessionsInWindow,
    completedSessionsInWindow,
    avgDifficulty,
    maxSessionGapDays,
  };
}
