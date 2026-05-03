import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import { api } from '@/lib/api';
import type { FeedingLog, Guidance, Side } from '@/lib/types';
import { SideButton } from '@/components/SideButton';
import { QualityRating } from '@/components/QualityRating';
import { DurationStepper } from '@/components/DurationStepper';
import { SessionCard } from '@/components/SessionCard';
import { GuidanceTip } from '@/components/GuidanceTip';
import { DailySummary } from '@/components/DailySummary';
import { StartTimePicker } from '@/components/StartTimePicker';
import { useAuth } from '@/lib/store';
import { isToday } from '@/lib/format';

const SIDES: Side[] = ['LEFT', 'RIGHT', 'BOTH'];

export default function QuickLogScreen() {
  const { signOut, user } = useAuth();

  const [latest, setLatest] = useState<FeedingLog | null>(null);
  const [guidance, setGuidance] = useState<Guidance | null>(null);
  const [recentLogs, setRecentLogs] = useState<FeedingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [side, setSide] = useState<Side | null>(null);
  const [durationMin, setDurationMin] = useState(15);
  const [qualityScore, setQualityScore] = useState(4);
  const [startTime, setStartTime] = useState<Date | null>(null);

  const todayLogs = useMemo(() => recentLogs.filter((l) => isToday(l.startTime)), [recentLogs]);

  const refreshState = useCallback(async (): Promise<Guidance> => {
    const [latestResp, listResp] = await Promise.all([api.getLatest(), api.listLogs(50)]);
    setLatest(latestResp.log);
    setGuidance(latestResp.guidance);
    setRecentLogs(listResp.logs);
    return latestResp.guidance;
  }, []);

  const loadInitial = useCallback(async () => {
    try {
      const g = await refreshState();
      setSide((cur) => cur ?? g.nextSide);
    } catch (err) {
      Alert.alert('טעינה נכשלה', err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setLoading(false);
    }
  }, [refreshState]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshState();
    } catch (err) {
      Alert.alert('טעינה נכשלה', err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setRefreshing(false);
    }
  }, [refreshState]);

  const onSubmit = useCallback(async () => {
    if (!side) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.createLog({
        side,
        durationMin,
        qualityScore,
        ...(startTime ? { startTime: startTime.toISOString() } : {}),
      });
      // Re-fetch so guidance + latest reflect the true newest log even when
      // the user reported a feeding from earlier today.
      const g = await refreshState();
      setSide(g.nextSide);
      setDurationMin(15);
      setQualityScore(4);
      setStartTime(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('שמירה נכשלה', err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setSubmitting(false);
    }
  }, [side, durationMin, qualityScore, startTime, refreshState]);

  if (loading || !guidance) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-50">
        <ActivityIndicator color="#DB2777" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-50" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#DB2777" />}
      >
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-brand-700">היי {user?.displayName ?? 'אמא'} 👋</Text>
          <Pressable onPress={signOut} accessibilityRole="button" accessibilityLabel="יציאה">
            <Text className="text-sm font-semibold text-brand-600">יציאה</Text>
          </Pressable>
        </View>

        <View className="gap-4">
          <SessionCard latest={latest} guidance={guidance} />
          <DailySummary logs={todayLogs} />

          <Link href="/history" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="פתיחת היסטוריית הנקות"
              className="flex-row items-center justify-between rounded-3xl bg-white px-5 py-4"
            >
              <Text className="text-base font-semibold text-brand-700">היסטוריית הנקות</Text>
              <Text className="text-2xl font-light text-brand-600">›</Text>
            </Pressable>
          </Link>

          <GuidanceTip tip={guidance.tip} />

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
                  recommended={guidance.nextSide === s}
                  onPress={setSide}
                />
              ))}
            </View>

            <Text className="mt-5 text-xs font-semibold uppercase tracking-wide text-brand-600">משך</Text>
            <View className="mt-2">
              <DurationStepper value={durationMin} onChange={setDurationMin} />
            </View>

            <Text className="mt-5 text-xs font-semibold uppercase tracking-wide text-brand-600">איכות</Text>
            <View className="mt-2">
              <QualityRating value={qualityScore} onChange={setQualityScore} />
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="px-4 pb-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="שמירת הנקה"
          onPress={onSubmit}
          disabled={submitting || !side}
          className={`items-center justify-center rounded-3xl py-5 ${
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
    </SafeAreaView>
  );
}
