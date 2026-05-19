import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from '@/lib/api';
import type { FeedingLog, Guidance, Side } from '@/lib/types';
import { SideButton } from '@/components/SideButton';
import { QualityRating } from '@/components/QualityRating';
import { SessionCard } from '@/components/SessionCard';
import { GuidanceTip } from '@/components/GuidanceTip';
import { DailySummary } from '@/components/DailySummary';
import { StartTimePicker } from '@/components/StartTimePicker';
import { HistoryList } from '@/components/HistoryList';
import { OfflineBadge } from '@/components/OfflineBadge';
import { EditLogSheet } from '@/components/EditLogSheet';
import { useAuth } from '@/lib/store';
import { isToday } from '@/lib/format';
import { pendingToLog, useOfflineQueue } from '@/lib/offline-queue';

const SIDES: Side[] = ['LEFT', 'RIGHT'];
const CACHE_KEY = 'lactasync.cache.v1';

interface CachedView {
  latest: FeedingLog | null;
  guidance: Guidance | null;
  recentLogs: FeedingLog[];
  cachedAt: number;
}

export default function QuickLogScreen() {
  const { signOut, user } = useAuth();
  const isOnline = useOfflineQueue((s) => s.isOnline);
  const pending = useOfflineQueue((s) => s.pending);
  const flushing = useOfflineQueue((s) => s.flushing);
  const enqueue = useOfflineQueue((s) => s.enqueue);
  const updatePending = useOfflineQueue((s) => s.updatePending);
  const removePending = useOfflineQueue((s) => s.removePending);
  const setOnline = useOfflineQueue((s) => s.setOnline);

  const [latest, setLatest] = useState<FeedingLog | null>(null);
  const [guidance, setGuidance] = useState<Guidance | null>(null);
  const [recentLogs, setRecentLogs] = useState<FeedingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [side, setSide] = useState<Side | null>(null);
  const [qualityScore, setQualityScore] = useState(4);
  const [startTime, setStartTime] = useState<Date | null>(null);

  const [editing, setEditing] = useState<FeedingLog | null>(null);

  // Pending entries are server-unaware — synthesize FeedingLog rows so the
  // home screen and inline history reflect them immediately. Server-confirmed
  // rows always win on the next refresh because pending is cleared by flush.
  const pendingLogs = useMemo<FeedingLog[]>(() => {
    if (!user) return [];
    return pending.map((p) => pendingToLog(p, user.id));
  }, [pending, user]);

  const allLogs = useMemo(() => [...pendingLogs, ...recentLogs], [pendingLogs, recentLogs]);
  const todayLogs = useMemo(() => allLogs.filter((l) => isToday(l.startTime)), [allLogs]);

  const persistCache = useCallback(
    async (snapshot: { latest: FeedingLog | null; guidance: Guidance | null; recentLogs: FeedingLog[] }) => {
      try {
        const payload: CachedView = { ...snapshot, cachedAt: Date.now() };
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      } catch {
        // Best-effort cache; ignore write errors.
      }
    },
    [],
  );

  const hydrateFromCache = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      const cached = JSON.parse(raw) as CachedView;
      setLatest(cached.latest);
      setGuidance(cached.guidance);
      setRecentLogs(cached.recentLogs);
      return true;
    } catch {
      return false;
    }
  }, []);

  const refreshFromServer = useCallback(async (): Promise<Guidance | null> => {
    try {
      const [latestResp, listResp] = await Promise.all([api.getLatest(), api.listLogs(50)]);
      setLatest(latestResp.log);
      setGuidance(latestResp.guidance);
      setRecentLogs(listResp.logs);
      void persistCache({
        latest: latestResp.log,
        guidance: latestResp.guidance,
        recentLogs: listResp.logs,
      });
      // A successful round-trip is the strongest signal we're online; flips
      // isOnline back to true and triggers the queue flush if there's work.
      setOnline(true);
      return latestResp.guidance;
    } catch (err) {
      if (!(err instanceof ApiError)) setOnline(false);
      throw err;
    }
  }, [persistCache, setOnline]);

  const loadInitial = useCallback(async () => {
    const hadCache = await hydrateFromCache();
    if (hadCache) setLoading(false);
    try {
      const g = await refreshFromServer();
      if (g) setSide((cur) => cur ?? (g.nextSide === 'BOTH' ? 'LEFT' : g.nextSide));
    } catch (err) {
      // Silent on startup if we already have cache; otherwise surface.
      if (!hadCache) {
        Alert.alert('טעינה נכשלה', err instanceof Error ? err.message : 'שגיאה לא ידועה');
      }
    } finally {
      setLoading(false);
    }
  }, [hydrateFromCache, refreshFromServer]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshFromServer();
    } catch (err) {
      // If the user is offline, they likely already see the offline badge —
      // skip the noisy alert. Surface only unexpected (server) errors.
      if (err instanceof ApiError) {
        Alert.alert('טעינה נכשלה', err.message);
      }
    } finally {
      setRefreshing(false);
    }
  }, [refreshFromServer]);

  const onSubmit = useCallback(async () => {
    if (!side) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Always anchor to the tap moment so offline-queued entries don't drift to
    // the sync time when they reach the server.
    const effectiveStart = (startTime ?? new Date()).toISOString();
    const payload = {
      side,
      qualityScore,
      durationMin: 0,
      startTime: effectiveStart,
    };

    const resetForm = () => {
      setQualityScore(4);
      setStartTime(null);
    };

    const finishOk = (nextSide?: Side) => {
      if (nextSide && nextSide !== 'BOTH') setSide(nextSide);
      resetForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    try {
      if (!isOnline) {
        await enqueue(payload);
        finishOk();
        return;
      }
      try {
        await api.createLog(payload);
        const g = await refreshFromServer();
        finishOk(g?.nextSide);
      } catch (err) {
        if (err instanceof ApiError) {
          // Server said no — don't queue, surface the error.
          throw err;
        }
        // Network error mid-request → flip to offline + enqueue so the user
        // doesn't lose the entry. The next successful fetch flushes the queue.
        setOnline(false);
        await enqueue(payload);
        finishOk();
      }
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('שמירה נכשלה', err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setSubmitting(false);
    }
  }, [side, qualityScore, startTime, isOnline, enqueue, setOnline, refreshFromServer]);

  const handleSaveEdit = useCallback(
    async (log: FeedingLog, updates: { side: Side; qualityScore: number; startTime: string }) => {
      if (log.pending) {
        // Edit lives entirely in the local queue until the flush eventually
        // posts the corrected payload.
        await updatePending(log.id, updates);
        return;
      }
      // Optimistic UI: apply the change locally, then send to the server. If
      // the request fails we surface the error and refresh to reconcile.
      const optimistic: FeedingLog = { ...log, ...updates, updatedAt: new Date().toISOString() };
      setRecentLogs((prev) => prev.map((l) => (l.id === log.id ? optimistic : l)));
      setLatest((prev) => (prev?.id === log.id ? optimistic : prev));
      try {
        await api.updateLog(log.id, updates);
        await refreshFromServer();
      } catch (err) {
        // Roll back and rethrow so the modal surfaces the error.
        setRecentLogs((prev) => prev.map((l) => (l.id === log.id ? log : l)));
        setLatest((prev) => (prev?.id === log.id ? log : prev));
        throw err;
      }
    },
    [updatePending, refreshFromServer],
  );

  const handleDeleteLog = useCallback(
    async (log: FeedingLog) => {
      if (log.pending) {
        await removePending(log.id);
        return;
      }
      const prevList = recentLogs;
      const prevLatest = latest;
      setRecentLogs((prev) => prev.filter((l) => l.id !== log.id));
      setLatest((prev) => (prev?.id === log.id ? null : prev));
      try {
        await api.deleteLog(log.id);
        await refreshFromServer();
      } catch (err) {
        setRecentLogs(prevList);
        setLatest(prevLatest);
        throw err;
      }
    },
    [removePending, recentLogs, latest, refreshFromServer],
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-50">
        <ActivityIndicator color="#DB2777" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-50" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#DB2777" />}
      >
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-brand-700">היי {user?.displayName ?? 'אמא'} 👋</Text>
          <Pressable onPress={signOut} accessibilityRole="button" accessibilityLabel="יציאה">
            <Text className="text-sm font-semibold text-brand-600">יציאה</Text>
          </Pressable>
        </View>

        <View className="mb-3">
          <OfflineBadge isOnline={isOnline} pendingCount={pending.length} flushing={flushing} />
        </View>

        <View className="gap-4">
          {guidance ? <SessionCard latest={latest} guidance={guidance} /> : null}
          <DailySummary logs={todayLogs} />
          {guidance?.tip ? <GuidanceTip tip={guidance.tip} /> : null}

          <View className="rounded-3xl bg-white p-5">
            <Text className="text-xs font-semibold uppercase tracking-wide text-brand-600">מתי?</Text>
            <View className="mt-2">
              <StartTimePicker value={startTime} onChange={setStartTime} />
            </View>

            <Text className="mt-5 text-xs font-semibold uppercase tracking-wide text-brand-600">צד</Text>
            <View className="mt-2 flex-row gap-3">
              {SIDES.map((s) => (
                <SideButton
                  key={s}
                  side={s}
                  selected={side === s}
                  recommended={guidance?.nextSide === s}
                  onPress={setSide}
                />
              ))}
            </View>

            <Text className="mt-5 text-xs font-semibold uppercase tracking-wide text-brand-600">איכות</Text>
            <View className="mt-2">
              <QualityRating value={qualityScore} onChange={setQualityScore} />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="שמירת הנקה"
              onPress={onSubmit}
              disabled={submitting || !side}
              className={`mt-5 items-center justify-center rounded-3xl py-5 ${
                submitting || !side ? 'bg-brand-400' : 'bg-brand-600'
              }`}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-lg font-bold text-white">שמירת ההנקה</Text>
              )}
            </Pressable>
          </View>

          <View>
            <Text className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
              היסטוריה
            </Text>
            <HistoryList logs={allLogs} onPressLog={setEditing} />
          </View>
        </View>
      </ScrollView>

      <EditLogSheet
        log={editing}
        visible={editing !== null}
        onClose={() => setEditing(null)}
        onSave={(updates) => (editing ? handleSaveEdit(editing, updates) : Promise.resolve())}
        onDelete={() => (editing ? handleDeleteLog(editing) : Promise.resolve())}
      />
    </SafeAreaView>
  );
}
