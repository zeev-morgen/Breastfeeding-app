import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
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
import { useAuth } from '@/lib/store';
import { isToday } from '@/lib/format';
import { pendingToLog, useOfflineQueue } from '@/lib/offline-queue';

const SIDES: Side[] = ['LEFT', 'RIGHT'];
const CACHE_KEY = 'lactasync.cache.v1';

// Soft background images for the home banner
const BG_IMAGES = [
  'https://images.unsplash.com/photo-1502872364588-894d7d6ddfab?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517242810446-cc8951b2be40?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=800&auto=format&fit=crop&q=80',
];

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

  // Rotate through background images
  const [bgIdx, setBgIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setBgIdx((i) => (i + 1) % BG_IMAGES.length), 10000);
    return () => clearInterval(id);
  }, []);

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
        // best-effort
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

    const payload = {
      side,
      qualityScore,
      durationMin: 0,
      ...(startTime ? { startTime: startTime.toISOString() } : {}),
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

  if (loading) {
    return (
      <SafeAreaView style={s.loadingWrap} edges={['top']}>
        <StatusBar style="dark" />
        <ActivityIndicator color={PRIMARY} />
      </SafeAreaView>
    );
  }

  const displayName = user?.displayName ?? 'אמא';

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {/* Photographic banner — sits behind all content */}
      <ImageBackground
        source={{ uri: BG_IMAGES[bgIdx] }}
        style={s.banner}
        resizeMode="cover"
      >
        <View style={s.bannerOverlay} />
      </ImageBackground>

      <SafeAreaView style={s.safeArea} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.dateLabel}>
              {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <Text style={s.greeting}>
              בוקר טוב, <Text style={s.greetingAccent}>{displayName}</Text>
            </Text>
          </View>
          <Pressable onPress={signOut} accessibilityRole="button" accessibilityLabel="יציאה">
            <View style={s.avatar}>
              <Text style={s.avatarText}>{displayName.charAt(0)}</Text>
            </View>
          </Pressable>
        </View>

        {/* Offline badge */}
        {(!isOnline || (flushing && pending.length > 0)) ? (
          <View style={s.badgeWrap}>
            <OfflineBadge isOnline={isOnline} pendingCount={pending.length} flushing={flushing} />
          </View>
        ) : null}

        {/* Main scroll */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY}
              colors={[PRIMARY]}
            />
          }
        >
          {/* Last + next feeding card */}
          {guidance ? (
            <View style={s.section}>
              <SessionCard latest={latest} guidance={guidance} />
            </View>
          ) : null}

          {/* Daily summary */}
          {todayLogs.length > 0 && (
            <View style={s.section}>
              <DailySummary logs={todayLogs} />
            </View>
          )}

          {/* Guidance tip */}
          {guidance?.tip ? (
            <View style={s.section}>
              <GuidanceTip tip={guidance.tip} />
            </View>
          ) : null}

          {/* Quick log card */}
          <View style={[s.section, s.logCard]}>
            <View style={s.logCardHeader}>
              <Text style={s.logCardTitle}>תיעוד הנקה</Text>
              <Text style={s.logCardTime}>
                {new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>

            {/* Time picker */}
            <View style={s.logField}>
              <Text style={s.logFieldLabel}>מתי?</Text>
              <StartTimePicker value={startTime} onChange={setStartTime} />
            </View>

            {/* Side */}
            <View style={s.logField}>
              <Text style={s.logFieldLabel}>צד</Text>
              <View style={s.sideRow}>
                {SIDES.map((sv) => (
                  <SideButton
                    key={sv}
                    side={sv}
                    selected={side === sv}
                    recommended={guidance?.nextSide === sv}
                    onPress={setSide}
                  />
                ))}
              </View>
            </View>

            {/* Quality */}
            <View style={s.logField}>
              <QualityRating value={qualityScore} onChange={setQualityScore} />
            </View>

            {/* Save */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="שמירת הנקה"
              onPress={onSubmit}
              disabled={submitting || !side}
              style={({ pressed }) => [
                s.saveBtn,
                (!side || submitting) && s.saveBtnDisabled,
                pressed && { opacity: 0.85 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={s.saveArrow}>←</Text>
                  <Text style={s.saveLabel}>שמירת ההנקה</Text>
                  <View style={{ width: 18 }} />
                </>
              )}
            </Pressable>
          </View>

          {/* History */}
          <View style={s.historySection}>
            <Text style={s.historySectionLabel}>היסטוריה</Text>
            <HistoryList logs={allLogs} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const CREAM = '#F4ECE2';
const SURFACE = '#FBF6EE';
const INK = '#2B1F1A';
const INK_SOFT = '#6B5A50';
const PRIMARY = '#C76A4A';

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CREAM,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CREAM,
  },
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(36,20,12,0.22)',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  dateLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 4,
    textAlign: 'right',
  },
  greeting: {
    fontFamily: 'serif',
    fontSize: 26,
    color: '#fff',
    fontWeight: '500',
    lineHeight: 32,
    textAlign: 'right',
  },
  greetingAccent: {
    color: '#EAD0BF',
    fontStyle: 'italic',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'serif',
    fontSize: 18,
    color: PRIMARY,
    fontWeight: '500',
  },
  badgeWrap: {
    paddingHorizontal: 24,
    marginBottom: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    paddingTop: 4,
  },
  section: {
    marginBottom: 12,
  },
  logCard: {
    backgroundColor: SURFACE,
    borderRadius: 24,
    padding: 22,
  },
  logCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  logCardTitle: {
    fontFamily: 'serif',
    fontSize: 20,
    color: INK,
    fontWeight: '500',
  },
  logCardTime: {
    fontSize: 11,
    color: INK_SOFT,
  },
  logField: {
    marginBottom: 18,
  },
  logFieldLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: INK_SOFT,
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'right',
  },
  sideRow: {
    flexDirection: 'row',
    gap: 10,
  },
  saveBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  saveBtnDisabled: {
    opacity: 0.55,
  },
  saveArrow: {
    color: '#fff',
    fontSize: 18,
  },
  saveLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  historySection: {
    marginTop: 8,
  },
  historySectionLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: INK_SOFT,
    textTransform: 'uppercase',
    marginBottom: 4,
    paddingHorizontal: 2,
    textAlign: 'right',
  },
});
