import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api';
import type { FeedingLog, Guidance, Side } from '@/lib/types';
import { SideButton } from '@/components/SideButton';
import { QualityRating } from '@/components/QualityRating';
import { DurationStepper } from '@/components/DurationStepper';
import { SessionCard } from '@/components/SessionCard';
import { GuidanceTip } from '@/components/GuidanceTip';
import { useAuth } from '@/lib/store';

const SIDES: Side[] = ['LEFT', 'RIGHT', 'BOTH'];

export default function QuickLogScreen() {
  const { signOut, user } = useAuth();

  const [latest, setLatest] = useState<FeedingLog | null>(null);
  const [guidance, setGuidance] = useState<Guidance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [side, setSide] = useState<Side | null>(null);
  const [durationMin, setDurationMin] = useState(15);
  const [qualityScore, setQualityScore] = useState(4);

  const loadLatest = useCallback(async () => {
    try {
      const { log, guidance: g } = await api.getLatest();
      setLatest(log);
      setGuidance(g);
      if (!side) setSide(g.nextSide);
    } catch (err) {
      Alert.alert('טעינה נכשלה', err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setLoading(false);
    }
  }, [side]);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLatest();
    setRefreshing(false);
  }, [loadLatest]);

  const onSubmit = useCallback(async () => {
    if (!side) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { log, guidance: g } = await api.createLog({ side, durationMin, qualityScore });
      setLatest(log);
      setGuidance(g);
      setSide(g.nextSide);
      setDurationMin(15);
      setQualityScore(4);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('שמירה נכשלה', err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setSubmitting(false);
    }
  }, [side, durationMin, qualityScore]);

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
          <GuidanceTip tip={guidance.tip} />

          <View className="rounded-3xl bg-white p-5">
            <Text className="text-xs font-semibold uppercase tracking-wide text-brand-600">צד</Text>
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
