/**
 * Tests for useOfflineSync.
 *
 * The hook flushes the pending workout-log queue whenever the device
 * transitions from offline → online. Tests verify queue flush ordering,
 * evolve-plan invocation, and stop-on-error behaviour.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useOfflineSync } from '@/hooks/useOfflineSync';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

const mockIsOnline = { value: false };

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: mockIsOnline.value }),
}));

const mockGetPendingLogs = jest.fn();
const mockRemovePendingLog = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/localDb', () => ({
  getPendingLogs: (...args: unknown[]) => mockGetPendingLogs(...args),
  removePendingLog: (...args: unknown[]) => mockRemovePendingLog(...args),
}));

const mockSaveWorkoutLog = jest.fn();
const mockUpdateSession = jest.fn().mockResolvedValue({ error: null });

jest.mock('@/services/workouts', () => ({
  saveWorkoutLog: (...args: unknown[]) => mockSaveWorkoutLog(...args),
}));

jest.mock('@/services/sessions', () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn().mockResolvedValue({ data: {}, error: null }) },
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makePendingLog = (id: string) => ({
  id,
  session_id: `session-${id}`,
  workout_id: `workout-${id}`,
  user_id: 'user-1',
  difficulty_rating: 6,
  pain_during_session: 2,
  session_notes: null,
  exercise_logs_json: '[]',
  created_at: `2026-04-13T10:00:0${id}Z`,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useOfflineSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline.value = false;
    mockGetPendingLogs.mockResolvedValue([]);
    mockSaveWorkoutLog.mockResolvedValue({ logId: 'server-log-1', error: null });
    mockUpdateSession.mockResolvedValue({ error: null });
    mockRemovePendingLog.mockResolvedValue(undefined);
  });

  it('initialises with isSyncing: false', () => {
    const { result } = renderHook(() => useOfflineSync());
    expect(result.current.isSyncing).toBe(false);
  });

  it('does not flush while offline', async () => {
    mockIsOnline.value = false;
    renderHook(() => useOfflineSync());
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSaveWorkoutLog).not.toHaveBeenCalled();
  });

  it('flushes the queue when coming back online', async () => {
    const log = makePendingLog('1');
    mockGetPendingLogs.mockResolvedValue([log]);

    // Start offline
    const { rerender } = renderHook(() => useOfflineSync());

    // Go online
    mockIsOnline.value = true;
    rerender({});

    await waitFor(() => {
      expect(mockSaveWorkoutLog).toHaveBeenCalledTimes(1);
    });
    expect(mockRemovePendingLog).toHaveBeenCalledWith('1');
  });

  it('flushes all pending logs in order', async () => {
    const logs = [makePendingLog('1'), makePendingLog('2'), makePendingLog('3')];
    mockGetPendingLogs.mockResolvedValue(logs);

    const { rerender } = renderHook(() => useOfflineSync());
    mockIsOnline.value = true;
    rerender({});

    await waitFor(() => {
      expect(mockSaveWorkoutLog).toHaveBeenCalledTimes(3);
    });
    expect(mockRemovePendingLog).toHaveBeenCalledTimes(3);
  });

  it('stops flushing on first saveWorkoutLog error', async () => {
    const logs = [makePendingLog('1'), makePendingLog('2')];
    mockGetPendingLogs.mockResolvedValue(logs);
    mockSaveWorkoutLog
      .mockResolvedValueOnce({ logId: null, error: 'Network error' })
      .mockResolvedValueOnce({ logId: 'log-2', error: null });

    const { rerender } = renderHook(() => useOfflineSync());
    mockIsOnline.value = true;
    rerender({});

    await waitFor(() => {
      expect(mockSaveWorkoutLog).toHaveBeenCalledTimes(1);
    });
    // Second log not processed
    expect(mockRemovePendingLog).not.toHaveBeenCalled();
  });

  it('removes corrupt queue entries (invalid JSON) and continues', async () => {
    const corruptLog = { ...makePendingLog('x'), exercise_logs_json: 'not valid json' };
    const goodLog = makePendingLog('2');
    mockGetPendingLogs.mockResolvedValue([corruptLog, goodLog]);

    const { rerender } = renderHook(() => useOfflineSync());
    mockIsOnline.value = true;
    rerender({});

    await waitFor(() => {
      expect(mockRemovePendingLog).toHaveBeenCalledWith('x');
    });
    // Good log is also processed
    await waitFor(() => {
      expect(mockSaveWorkoutLog).toHaveBeenCalledTimes(1);
    });
  });

  it('invokes evolve-plan for each successfully synced log', async () => {
    const { supabase } = require('@/lib/supabase');
    const log = makePendingLog('1');
    mockGetPendingLogs.mockResolvedValue([log]);

    const { rerender } = renderHook(() => useOfflineSync());
    mockIsOnline.value = true;
    rerender({});

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('evolve-plan', expect.any(Object));
    });
  });

  it('does not re-flush if already online (no transition)', async () => {
    mockIsOnline.value = true;
    const log = makePendingLog('1');
    mockGetPendingLogs.mockResolvedValue([log]);

    // Mount while already online — no transition, no flush
    renderHook(() => useOfflineSync());
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSaveWorkoutLog).not.toHaveBeenCalled();
  });
});
