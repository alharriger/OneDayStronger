import { supabase } from '@/lib/supabase';
import {
  getWorkoutForSession,
  getMostRecentWorkout,
  saveWorkoutLog,
  getWorkoutLog,
} from '@/services/workouts';
import { createChain } from '../helpers/supabaseMock';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockedFrom = supabase.from as jest.Mock;

describe('workouts service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getWorkoutForSession', () => {
    it('returns null on error', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'not found' } }));
      const result = await getWorkoutForSession('session-1');
      expect(result).toBeNull();
    });

    it('returns workout data on success', async () => {
      const workout = { id: 'w-1', session_id: 'session-1', generated_workout_exercises: [] };
      mockedFrom.mockReturnValue(createChain({ data: workout, error: null }));
      const result = await getWorkoutForSession('session-1');
      expect(result).toEqual(workout);
    });
  });

  describe('saveWorkoutLog', () => {
    it('returns logId on success with no exercise logs', async () => {
      mockedFrom.mockReturnValue(createChain({ data: { id: 'log-1' }, error: null }));
      const result = await saveWorkoutLog(
        {
          user_id: 'user-1',
          session_id: 'session-1',
          difficulty_rating: 6,
          pain_during_session: 2,
        },
        [],
      );
      expect(result.logId).toBe('log-1');
      expect(result.error).toBeNull();
    });

    it('returns error when insert fails', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'DB error' } }));
      const result = await saveWorkoutLog(
        { user_id: 'u', session_id: 's' },
        [],
      );
      expect(result.logId).toBeNull();
      expect(result.error).toBe('DB error');
    });

    it('inserts exercise logs when provided', async () => {
      const workoutLogChain = createChain({ data: { id: 'log-1' }, error: null });
      const exerciseLogChain = createChain({ data: [], error: null });
      mockedFrom
        .mockReturnValueOnce(workoutLogChain)
        .mockReturnValueOnce(exerciseLogChain);

      const result = await saveWorkoutLog(
        { user_id: 'u', session_id: 's' },
        [{ workout_log_id: '', exercise_name: 'Nordic Curl', sets_completed: 3 }],
      );
      expect(result.logId).toBe('log-1');
      expect(result.error).toBeNull();
    });
  });

  describe('getWorkoutLog', () => {
    it('returns null on error', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'not found' } }));
      const result = await getWorkoutLog('session-1');
      expect(result).toBeNull();
    });

    it('returns log on success', async () => {
      const log = { id: 'log-1', session_id: 'session-1', difficulty_rating: 7 };
      mockedFrom.mockReturnValue(createChain({ data: log, error: null }));
      const result = await getWorkoutLog('session-1');
      expect(result).toEqual(log);
    });
  });
});
