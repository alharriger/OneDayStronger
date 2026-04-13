/**
 * Unit tests for the evolve-plan evaluator.
 * The evaluator is pure TypeScript (no Deno deps), so it runs directly in Jest.
 */
import {
  evaluatePlanProgress,
  EvolveInput,
  ProgressionCriteria,
  RegressionCriteria,
} from '../../supabase/functions/evolve-plan/evaluator';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const WINDOW_START = '2026-04-01';

const DEFAULT_PROGRESSION: ProgressionCriteria = {
  pain_threshold: 3,
  load_tolerance_pct: 80,
  consistency_pct: 70,
  window_days: 14,
};

const DEFAULT_REGRESSION: RegressionCriteria = {
  pain_consecutive_sessions: 3,
  missed_sessions_window: 4,
};

const PHASE_EXERCISES = [
  { prescribed_sets: 3 },
  { prescribed_sets: 3 },
  { prescribed_sets: 2 },
];

function makeSession(
  date: string,
  status: 'completed' | 'skipped' | 'scheduled' | 'rest_day' = 'completed'
) {
  return { scheduled_date: date, status };
}

function makeCheckIn(date: string, pain: number) {
  return { checked_in_at: `${date}T08:00:00Z`, pain_level: pain };
}

function makeExerciseLogs(setsPerExercise: number[]) {
  return setsPerExercise.map((sets) => ({ sets_completed: sets }));
}

function baseInput(overrides: Partial<EvolveInput> = {}): EvolveInput {
  return {
    windowStartDate: WINDOW_START,
    progressionCriteria: DEFAULT_PROGRESSION,
    regressionCriteria: DEFAULT_REGRESSION,
    recentCheckIns: [],
    sessions: [],
    exerciseLogs: [],
    phaseExercises: PHASE_EXERCISES,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('evaluatePlanProgress', () => {
  describe('continue — not enough data', () => {
    it('returns continue when no sessions have been completed', () => {
      const result = evaluatePlanProgress(baseInput({ sessions: [] }));
      expect(result.decision).toBe('continue');
    });

    it('returns continue when fewer completed sessions than window_days / 7', () => {
      // window_days=14 → need at least 2 completed
      const input = baseInput({
        sessions: [makeSession('2026-04-05', 'completed')],
        recentCheckIns: [makeCheckIn('2026-04-05', 1)],
      });
      const result = evaluatePlanProgress(input);
      expect(result.decision).toBe('continue');
    });

    it('rationale mentions required vs actual session count', () => {
      const result = evaluatePlanProgress(baseInput({ sessions: [] }));
      expect(result.rationale).toMatch(/0 completed session/);
      expect(result.rationale).toMatch(/required/);
    });
  });

  describe('progress — all criteria met', () => {
    it('returns progress when pain, load, and consistency all meet targets', () => {
      const input = baseInput({
        sessions: [
          makeSession('2026-04-01', 'completed'),
          makeSession('2026-04-04', 'completed'),
          makeSession('2026-04-07', 'completed'),
        ],
        recentCheckIns: [
          makeCheckIn('2026-04-01', 2),
          makeCheckIn('2026-04-04', 2),
          makeCheckIn('2026-04-07', 1),
        ],
        // 3 sessions × 8 prescribed sets = 24 expected; 24 done = 100%
        exerciseLogs: [
          ...makeExerciseLogs([3, 3, 2]),
          ...makeExerciseLogs([3, 3, 2]),
          ...makeExerciseLogs([3, 3, 2]),
        ],
      });
      const result = evaluatePlanProgress(input);
      expect(result.decision).toBe('progress');
    });

    it('rationale mentions all criteria passing', () => {
      const input = baseInput({
        sessions: [
          makeSession('2026-04-01', 'completed'),
          makeSession('2026-04-04', 'completed'),
        ],
        recentCheckIns: [
          makeCheckIn('2026-04-01', 1),
          makeCheckIn('2026-04-04', 1),
        ],
        exerciseLogs: [
          ...makeExerciseLogs([3, 3, 2]),
          ...makeExerciseLogs([3, 3, 2]),
        ],
      });
      const result = evaluatePlanProgress(input);
      expect(result.decision).toBe('progress');
      expect(result.rationale).toMatch(/all criteria met/i);
    });

    it('returns progress when pain equals the threshold exactly', () => {
      const input = baseInput({
        sessions: [
          makeSession('2026-04-01', 'completed'),
          makeSession('2026-04-04', 'completed'),
        ],
        recentCheckIns: [
          makeCheckIn('2026-04-01', 3), // exactly at threshold=3
          makeCheckIn('2026-04-04', 3),
        ],
        exerciseLogs: [
          ...makeExerciseLogs([3, 3, 2]),
          ...makeExerciseLogs([3, 3, 2]),
        ],
      });
      const result = evaluatePlanProgress(input);
      expect(result.decision).toBe('progress');
    });
  });

  describe('regress — pain spiking', () => {
    it('returns regress when consecutive high-pain sessions reach the limit', () => {
      // pain_consecutive_sessions=3; pain_threshold=3 → pain > 3 for 3 sessions
      const input = baseInput({
        sessions: [
          makeSession('2026-04-01', 'completed'),
          makeSession('2026-04-04', 'completed'),
          makeSession('2026-04-07', 'completed'),
          makeSession('2026-04-10', 'completed'),
        ],
        recentCheckIns: [
          makeCheckIn('2026-04-01', 1),
          makeCheckIn('2026-04-04', 5), // > threshold
          makeCheckIn('2026-04-07', 6), // > threshold
          makeCheckIn('2026-04-10', 7), // > threshold — 3 consecutive
        ],
      });
      const result = evaluatePlanProgress(input);
      expect(result.decision).toBe('regress');
    });

    it('does NOT regress when consecutive streak is broken', () => {
      const input = baseInput({
        sessions: [
          makeSession('2026-04-01', 'completed'),
          makeSession('2026-04-04', 'completed'),
          makeSession('2026-04-07', 'completed'),
          makeSession('2026-04-10', 'completed'),
        ],
        recentCheckIns: [
          makeCheckIn('2026-04-01', 6), // > threshold early
          makeCheckIn('2026-04-04', 6), // > threshold
          makeCheckIn('2026-04-07', 1), // low — breaks streak
          makeCheckIn('2026-04-10', 6), // > threshold — only 1 consecutive from end
        ],
        exerciseLogs: [
          ...makeExerciseLogs([3, 3, 2]),
          ...makeExerciseLogs([3, 3, 2]),
          ...makeExerciseLogs([3, 3, 2]),
          ...makeExerciseLogs([3, 3, 2]),
        ],
      });
      const result = evaluatePlanProgress(input);
      expect(result.decision).not.toBe('regress');
    });

    it('rationale mentions consecutive high-pain sessions', () => {
      const input = baseInput({
        sessions: [
          makeSession('2026-04-01', 'completed'),
          makeSession('2026-04-04', 'completed'),
          makeSession('2026-04-07', 'completed'),
          makeSession('2026-04-10', 'completed'),
        ],
        recentCheckIns: [
          makeCheckIn('2026-04-01', 2),
          makeCheckIn('2026-04-04', 5),
          makeCheckIn('2026-04-07', 6),
          makeCheckIn('2026-04-10', 7),
        ],
      });
      const result = evaluatePlanProgress(input);
      expect(result.decision).toBe('regress');
      expect(result.rationale).toMatch(/consecutive/i);
    });
  });

  describe('regress — missed sessions', () => {
    it('returns regress when missed sessions reach the window limit', () => {
      // missed_sessions_window=4; 4 skipped sessions
      const input = baseInput({
        sessions: [
          makeSession('2026-04-01', 'completed'),
          makeSession('2026-04-03', 'skipped'),
          makeSession('2026-04-05', 'skipped'),
          makeSession('2026-04-07', 'skipped'),
          makeSession('2026-04-09', 'skipped'),
          makeSession('2026-04-11', 'completed'),
        ],
        recentCheckIns: [
          makeCheckIn('2026-04-01', 1),
          makeCheckIn('2026-04-11', 1),
        ],
      });
      const result = evaluatePlanProgress(input);
      expect(result.decision).toBe('regress');
    });

    it('reports missed session count in rationale', () => {
      const input = baseInput({
        sessions: [
          makeSession('2026-04-01', 'completed'),
          makeSession('2026-04-03', 'skipped'),
          makeSession('2026-04-05', 'skipped'),
          makeSession('2026-04-07', 'skipped'),
          makeSession('2026-04-09', 'skipped'),
          makeSession('2026-04-11', 'completed'),
        ],
        recentCheckIns: [
          makeCheckIn('2026-04-01', 1),
          makeCheckIn('2026-04-11', 1),
        ],
      });
      const result = evaluatePlanProgress(input);
      expect(result.rationale).toMatch(/skipped/i);
    });
  });

  describe('hold — partial criteria met', () => {
    it('returns hold when pain is OK but load tolerance is below target', () => {
      const input = baseInput({
        sessions: [
          makeSession('2026-04-01', 'completed'),
          makeSession('2026-04-04', 'completed'),
        ],
        recentCheckIns: [
          makeCheckIn('2026-04-01', 1),
          makeCheckIn('2026-04-04', 2),
        ],
        // prescribed: 8 sets/session × 2 sessions = 16 expected; done: 8 total (50% < 80% target)
        exerciseLogs: [
          ...makeExerciseLogs([2, 2, 0]),
          ...makeExerciseLogs([2, 2, 0]),
        ],
      });
      const result = evaluatePlanProgress(input);
      expect(result.decision).toBe('hold');
    });

    it('returns hold when consistency is below target', () => {
      // consistency_pct=70; 2 completed, 2 skipped = 50% < 70%
      const input = baseInput({
        sessions: [
          makeSession('2026-04-01', 'completed'),
          makeSession('2026-04-04', 'skipped'),
          makeSession('2026-04-07', 'completed'),
          makeSession('2026-04-10', 'skipped'),
        ],
        recentCheckIns: [
          makeCheckIn('2026-04-01', 1),
          makeCheckIn('2026-04-07', 2),
        ],
        exerciseLogs: [
          ...makeExerciseLogs([3, 3, 2]),
          ...makeExerciseLogs([3, 3, 2]),
        ],
      });
      const result = evaluatePlanProgress(input);
      expect(result.decision).toBe('hold');
    });

    it('rationale lists which criteria failed', () => {
      const input = baseInput({
        sessions: [
          makeSession('2026-04-01', 'completed'),
          makeSession('2026-04-04', 'completed'),
        ],
        recentCheckIns: [
          makeCheckIn('2026-04-01', 1),
          makeCheckIn('2026-04-04', 2),
        ],
        exerciseLogs: [
          ...makeExerciseLogs([1, 1, 0]),
          ...makeExerciseLogs([1, 1, 0]),
        ],
      });
      const result = evaluatePlanProgress(input);
      expect(result.decision).toBe('hold');
      expect(result.rationale).toMatch(/holding/i);
    });
  });

  describe('regression priority over progression', () => {
    it('regresses even when progression criteria are also met', () => {
      // All progression criteria met BUT 3 consecutive high-pain sessions
      const input = baseInput({
        sessions: [
          makeSession('2026-04-01', 'completed'),
          makeSession('2026-04-04', 'completed'),
          makeSession('2026-04-07', 'completed'),
          makeSession('2026-04-10', 'completed'),
        ],
        recentCheckIns: [
          makeCheckIn('2026-04-01', 1),
          makeCheckIn('2026-04-04', 5), // > threshold
          makeCheckIn('2026-04-07', 6), // > threshold
          makeCheckIn('2026-04-10', 7), // > threshold — 3 consecutive
        ],
        exerciseLogs: [
          ...makeExerciseLogs([3, 3, 2]),
          ...makeExerciseLogs([3, 3, 2]),
          ...makeExerciseLogs([3, 3, 2]),
          ...makeExerciseLogs([3, 3, 2]),
        ],
      });
      const result = evaluatePlanProgress(input);
      expect(result.decision).toBe('regress');
    });
  });

  describe('metrics', () => {
    it('returns correct avgPain', () => {
      const input = baseInput({
        sessions: [
          makeSession('2026-04-01', 'completed'),
          makeSession('2026-04-04', 'completed'),
        ],
        recentCheckIns: [
          makeCheckIn('2026-04-01', 2),
          makeCheckIn('2026-04-04', 4),
        ],
        exerciseLogs: [
          ...makeExerciseLogs([3, 3, 2]),
          ...makeExerciseLogs([3, 3, 2]),
        ],
      });
      const result = evaluatePlanProgress(input);
      expect(result.metrics.avgPain).toBe(3); // (2+4)/2
    });

    it('returns 100% load tolerance when no exercise logs exist', () => {
      const input = baseInput({
        sessions: [
          makeSession('2026-04-01', 'completed'),
          makeSession('2026-04-04', 'completed'),
        ],
        recentCheckIns: [
          makeCheckIn('2026-04-01', 2),
          makeCheckIn('2026-04-04', 2),
        ],
        exerciseLogs: [], // no exercise-level logs
      });
      const result = evaluatePlanProgress(input);
      expect(result.metrics.loadTolerancePct).toBe(100);
    });

    it('rest_day sessions are excluded from consistency calculation', () => {
      const input = baseInput({
        sessions: [
          makeSession('2026-04-01', 'completed'),
          makeSession('2026-04-03', 'rest_day'),
          makeSession('2026-04-04', 'completed'),
          makeSession('2026-04-06', 'rest_day'),
        ],
        recentCheckIns: [
          makeCheckIn('2026-04-01', 2),
          makeCheckIn('2026-04-04', 2),
        ],
        exerciseLogs: [
          ...makeExerciseLogs([3, 3, 2]),
          ...makeExerciseLogs([3, 3, 2]),
        ],
      });
      const result = evaluatePlanProgress(input);
      // 2 completed, 0 skipped (rest days excluded) → 100% consistency
      expect(result.metrics.consistencyPct).toBe(100);
    });

    it('filters out check-ins and sessions before windowStartDate', () => {
      const input = baseInput({
        sessions: [
          makeSession('2026-03-15', 'completed'), // before window
          makeSession('2026-04-01', 'completed'),
          makeSession('2026-04-04', 'completed'),
        ],
        recentCheckIns: [
          makeCheckIn('2026-03-15', 8), // before window — high pain ignored
          makeCheckIn('2026-04-01', 1),
          makeCheckIn('2026-04-04', 2),
        ],
        exerciseLogs: [
          ...makeExerciseLogs([3, 3, 2]),
          ...makeExerciseLogs([3, 3, 2]),
        ],
      });
      const result = evaluatePlanProgress(input);
      // Only in-window check-ins (pain 1 and 2) → avg 1.5 ≤ threshold 3
      expect(result.metrics.avgPain).toBeLessThanOrEqual(3);
    });
  });
});
