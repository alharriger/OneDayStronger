import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { getPainColor } from '@/theme/colors';
import { getRecentSessions } from '@/services/sessions';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/lib/database.types';

type Session = Database['public']['Tables']['sessions']['Row'];

const SESSION_STATUS_LABEL: Record<string, string> = {
  completed: 'Completed',
  skipped: 'Skipped',
  rest_day: 'Rest day',
  scheduled: 'Scheduled',
};

// ─── Session row ──────────────────────────────────────────────────────────────

interface SessionRowProps {
  session: Session;
}

function SessionRow({ session }: SessionRowProps) {
  const date = new Date(session.scheduled_date);
  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const statusLabel = SESSION_STATUS_LABEL[session.status] ?? session.status;
  const statusColor =
    session.status === 'completed'
      ? Colors.semantic.success
      : session.status === 'skipped'
      ? Colors.text.disabled
      : session.status === 'rest_day'
      ? Colors.semantic.warning
      : Colors.text.secondary;

  return (
    <View style={styles.sessionRow}>
      <Text style={styles.dateText}>{dateLabel}</Text>
      <View style={styles.sessionMeta}>
        <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        {session.skip_reason && (
          <Text style={styles.skipReason}>{session.skip_reason}</Text>
        )}
      </View>
    </View>
  );
}

// ─── History screen ───────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getRecentSessions(user.id, 30)
      .then(setSessions)
      .finally(() => setLoading(false));
  }, [user]);

  const completedCount = sessions.filter((s) => s.status === 'completed').length;
  const skippedCount = sessions.filter((s) => s.status === 'skipped').length;
  const consistency =
    sessions.length > 0 ? Math.round((completedCount / sessions.length) * 100) : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.screenTitle}>History</Text>
        </View>

        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        )}

        {!loading && sessions.length === 0 && (
          <Text style={styles.emptyText}>
            No sessions yet. Complete your first workout to start tracking progress.
          </Text>
        )}

        {!loading && sessions.length > 0 && (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{completedCount}</Text>
                <Text style={styles.statLabel}>Sessions done</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: getPainColor(10 - consistency / 10) }]}>
                  {consistency}%
                </Text>
                <Text style={styles.statLabel}>Consistency</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{skippedCount}</Text>
                <Text style={styles.statLabel}>Skipped</Text>
              </View>
            </View>

            <Text style={styles.sectionHeading}>Recent sessions</Text>

            <View style={styles.sessionList}>
              {sessions.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bg.base } as ViewStyle,
  scroll: { flex: 1 } as ViewStyle,
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing.space8,
  } as ViewStyle,
  header: { paddingTop: Spacing.space4, marginBottom: Spacing.space5 } as ViewStyle,
  screenTitle: { ...Typography.h1, color: Colors.text.primary } as TextStyle,
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.space8,
  } as ViewStyle,
  emptyText: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.space6,
  } as TextStyle,
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.space3,
    marginBottom: Spacing.space6,
  } as ViewStyle,
  statCard: {
    flex: 1,
    backgroundColor: Colors.bg.surfaceRaised,
    borderRadius: Radius.lg,
    padding: Spacing.space4,
    alignItems: 'center',
    gap: Spacing.space1,
  } as ViewStyle,
  statValue: {
    ...Typography.h2,
    color: Colors.text.primary,
  } as TextStyle,
  statLabel: {
    ...Typography.label,
    color: Colors.text.secondary,
    textAlign: 'center',
  } as TextStyle,
  sectionHeading: {
    ...Typography.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.space3,
  } as TextStyle,
  sessionList: {
    gap: Spacing.space2,
  } as ViewStyle,
  sessionRow: {
    backgroundColor: Colors.bg.surfaceRaised,
    borderRadius: Radius.md,
    padding: Spacing.space4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  dateText: {
    ...Typography.body,
    color: Colors.text.primary,
  } as TextStyle,
  sessionMeta: {
    alignItems: 'flex-end',
    gap: 2,
  } as ViewStyle,
  statusText: {
    ...Typography.label,
  } as TextStyle,
  skipReason: {
    ...Typography.bodySmall,
    color: Colors.text.disabled,
  } as TextStyle,
});
