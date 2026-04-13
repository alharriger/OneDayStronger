import { renderHook, act } from '@testing-library/react-native';
import { useWorkoutLogging } from '@/hooks/useWorkoutLogging';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn().mockResolvedValue({ data: {}, error: null }) },
  },
}));

jest.mock('@/services/workouts', () => ({
  saveWorkoutLog: jest.fn().mockResolvedValue({ logId: 'log-1', error: null }),
}));

jest.mock('@/services/sessions', () => ({
  updateSession: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('@/services/safetyEvents', () => ({
  createSafetyEvent: jest.fn().mockResolvedValue({ event: { id: 'se-1' }, error: null }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const defaultProps = {
  sessionId: 'session-1',
  workoutId: 'workout-1',
  exercises: [
    { exerciseId: null, exerciseName: 'Nordic Curl', prescribedSets: 3 },
    { exerciseId: null, exerciseName: 'Hip Thrust', prescribedSets: 3 },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useWorkoutLogging', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initializes with form phase', () => {
    const { result } = renderHook(() => useWorkoutLogging(defaultProps));
    expect(result.current.phase).toBe('form');
  });

  it('initializes exercise actuals from prescribed exercises', () => {
    const { result } = renderHook(() => useWorkoutLogging(defaultProps));
    expect(result.current.exerciseActuals).toHaveLength(2);
    expect(result.current.exerciseActuals[0].exerciseName).toBe('Nordic Curl');
    expect(result.current.exerciseActuals[0].setsCompleted).toBe(3);
  });

  it('initializes with default ratings', () => {
    const { result } = renderHook(() => useWorkoutLogging(defaultProps));
    expect(result.current.difficultyRating).toBe(5);
    expect(result.current.painDuringSession).toBe(0);
    expect(result.current.sessionNotes).toBe('');
  });

  it('updates difficulty rating', () => {
    const { result } = renderHook(() => useWorkoutLogging(defaultProps));
    act(() => result.current.setDifficultyRating(8));
    expect(result.current.difficultyRating).toBe(8);
  });

  it('updates pain during session', () => {
    const { result } = renderHook(() => useWorkoutLogging(defaultProps));
    act(() => result.current.setPainDuringSession(4));
    expect(result.current.painDuringSession).toBe(4);
  });

  it('updates session notes', () => {
    const { result } = renderHook(() => useWorkoutLogging(defaultProps));
    act(() => result.current.setSessionNotes('Felt good'));
    expect(result.current.sessionNotes).toBe('Felt good');
  });

  it('updates exercise actuals', () => {
    const { result } = renderHook(() => useWorkoutLogging(defaultProps));
    const newActuals = { ...result.current.exerciseActuals[0], setsCompleted: 2 };
    act(() => result.current.setExerciseActual(0, newActuals));
    expect(result.current.exerciseActuals[0].setsCompleted).toBe(2);
  });

  describe('submit — low pain (no safety gate)', () => {
    it('calls saveWorkoutLog and transitions to success', async () => {
      const { saveWorkoutLog } = require('@/services/workouts');
      const { result } = renderHook(() => useWorkoutLogging(defaultProps));

      await act(async () => {
        await result.current.submit();
      });

      expect(saveWorkoutLog).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'test-user-id',
          session_id: 'session-1',
          generated_workout_id: 'workout-1',
        }),
        expect.any(Array),
      );
      expect(result.current.phase).toBe('success');
    });

    it('marks session as completed', async () => {
      const { updateSession } = require('@/services/sessions');
      const { result } = renderHook(() => useWorkoutLogging(defaultProps));

      await act(async () => {
        await result.current.submit();
      });

      expect(updateSession).toHaveBeenCalledWith('session-1', { status: 'completed' });
    });
  });

  describe('submit — high pain safety gate', () => {
    it('transitions to high_pain_warning when pain > 5', async () => {
      const { result } = renderHook(() => useWorkoutLogging(defaultProps));
      act(() => result.current.setPainDuringSession(7));

      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.phase).toBe('high_pain_warning');
    });

    it('does NOT call saveWorkoutLog before acknowledgment', async () => {
      const { saveWorkoutLog } = require('@/services/workouts');
      const { result } = renderHook(() => useWorkoutLogging(defaultProps));
      act(() => result.current.setPainDuringSession(7));

      await act(async () => {
        await result.current.submit();
      });

      expect(saveWorkoutLog).not.toHaveBeenCalled();
    });

    it('dismissHighPain returns to form phase', () => {
      const { result } = renderHook(() => useWorkoutLogging(defaultProps));
      act(() => result.current.setPainDuringSession(7));
      act(() => result.current.dismissHighPain());
      expect(result.current.phase).toBe('form');
    });

    it('acknowledgeHighPain creates a safety event and submits', async () => {
      const { createSafetyEvent } = require('@/services/safetyEvents');
      const { saveWorkoutLog } = require('@/services/workouts');
      const { result } = renderHook(() => useWorkoutLogging(defaultProps));

      act(() => result.current.setPainDuringSession(8));
      await act(async () => result.current.submit());
      expect(result.current.phase).toBe('high_pain_warning');

      await act(async () => {
        await result.current.acknowledgeHighPain();
      });

      expect(createSafetyEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'test-user-id',
          trigger: 'high_pain_logging',
          pain_level_reported: 8,
        }),
      );
      expect(saveWorkoutLog).toHaveBeenCalled();
      expect(result.current.phase).toBe('success');
    });
  });

  describe('submit — error handling', () => {
    it('transitions to error phase when saveWorkoutLog fails', async () => {
      const { saveWorkoutLog } = require('@/services/workouts');
      saveWorkoutLog.mockResolvedValueOnce({ logId: null, error: 'DB write failed' });

      const { result } = renderHook(() => useWorkoutLogging(defaultProps));

      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.phase).toBe('error');
      expect(result.current.error).toMatch(/could not save/i);
    });
  });
});
