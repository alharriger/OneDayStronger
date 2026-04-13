/**
 * useOfflineSync — watches the network status and flushes the pending
 * workout-log queue whenever the device comes back online.
 *
 * Mount this hook once at the app layout level so it stays active across
 * all tabs.
 *
 * Queue ordering: logs are flushed oldest-first (by created_at). On first
 * failure the flush stops so we don't submit out-of-order data.
 */
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getPendingLogs, removePendingLog } from '@/lib/localDb';
import { saveWorkoutLog } from '@/services/workouts';
import { updateSession } from '@/services/sessions';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type ExerciseLogInsert = Database['public']['Tables']['exercise_logs']['Insert'];

export interface OfflineSyncState {
  isSyncing: boolean;
  pendingCount: number;
}

export function useOfflineSync(): OfflineSyncState {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const prevOnline = useRef<boolean | null>(null);

  // Refresh pending count whenever the component mounts or network recovers
  useEffect(() => {
    if (!isOnline) return;
    getPendingLogs().then((logs) => setPendingCount(logs.length)).catch(() => {});
  }, [isOnline]);

  useEffect(() => {
    const justCameOnline = prevOnline.current === false && isOnline;
    prevOnline.current = isOnline;

    if (!justCameOnline || !user || isSyncing) return;

    setIsSyncing(true);

    (async () => {
      try {
        const logs = await getPendingLogs();
        if (logs.length === 0) return;

        for (const log of logs) {
          let exerciseInserts: ExerciseLogInsert[] = [];
          try {
            exerciseInserts = JSON.parse(log.exercise_logs_json) as ExerciseLogInsert[];
          } catch {
            // Corrupt queue entry — remove and continue
            await removePendingLog(log.id);
            continue;
          }

          const { logId, error } = await saveWorkoutLog(
            {
              user_id: log.user_id,
              session_id: log.session_id,
              generated_workout_id: log.workout_id,
              difficulty_rating: log.difficulty_rating,
              session_notes: log.session_notes ?? null,
              pain_during_session: log.pain_during_session,
            },
            exerciseInserts
          );

          if (error) {
            // Network may have dropped again — stop flush
            break;
          }

          await updateSession(log.session_id, { status: 'completed' });

          // Fire-and-forget evolve-plan
          supabase.functions
            .invoke('evolve-plan', { body: { sessionId: log.session_id, workoutLogId: logId } })
            .catch(() => {});

          await removePendingLog(log.id);
          setPendingCount((c) => Math.max(0, c - 1));
        }
      } finally {
        setIsSyncing(false);
      }
    })();
  }, [isOnline, user]);

  return { isSyncing, pendingCount };
}
