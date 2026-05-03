import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import type { FeedingLog } from '@/lib/types';
import { SIDE_LABEL, formatClock } from '@/lib/format';

interface DayGroup {
  dateKey: string;
  dateLabel: string;
  totalMin: number;
  count: number;
  qualitySum: number;
  logs: FeedingLog[];
}

const DAY_FORMATTER = new Intl.DateTimeFormat('he-IL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const target = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - target.getTime()) / 86_400_000);
  if (diffDays === 0 && target.getDate() === now.getDate()) return 'היום';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (target.getDate() === yesterday.getDate() && target.getMonth() === yesterday.getMonth()) return 'אתמול';
  return DAY_FORMATTER.format(target);
}

function groupByDay(logs: FeedingLog[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const log of logs) {
    const key = dayKey(log.startTime);
    const existing = map.get(key);
    if (existing) {
      existing.logs.push(log);
      existing.totalMin += log.durationMin;
      existing.qualitySum += log.qualityScore;
      existing.count += 1;
    } else {
      map.set(key, {
        dateKey: key,
        dateLabel: dayLabel(log.startTime),
        totalMin: log.durationMin,
        qualitySum: log.qualityScore,
        count: 1,
        logs: [log],
      });
    }
  }
  return Array.from(map.values());
}

const SIDE_BG: Record<string, string> = {
  LEFT: 'bg-pink-100',
  RIGHT: 'bg-purple-100',
  BOTH: 'bg-amber-100',
};

const SIDE_DOT: Record<string, string> = {
  LEFT: 'bg-pink-500',
  RIGHT: 'bg-purple-500',
  BOTH: 'bg-amber-500',
};

function QualityBadge({ score }: { score: number }) {
  const stars = '★'.repeat(score) + '☆'.repeat(5 - score);
  return <Text className="text-xs text-amber-500">{stars}</Text>;
}

function LogRow({ log }: { log: FeedingLog }) {
  return (
    <View className="mb-2 flex-row items-center gap-3 rounded-2xl bg-white p-4">
      <View className={`h-12 w-12 items-center justify-center rounded-2xl ${SIDE_BG[log.side]}`}>
        <View className={`h-2 w-2 rounded-full ${SIDE_DOT[log.side]}`} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-baseline gap-2">
          <Text className="text-base font-semibold text-gray-900">{SIDE_LABEL[log.side]}</Text>
          <Text className="text-sm text-gray-500">{log.durationMin} דק׳</Text>
        </View>
        <View className="mt-0.5 flex-row items-center gap-2">
          <Text className="text-xs text-gray-500">{formatClock(log.startTime)}</Text>
          <QualityBadge score={log.qualityScore} />
        </View>
      </View>
    </View>
  );
}

function DayHeader({ group }: { group: DayGroup }) {
  const avgQ = (group.qualitySum / group.count).toFixed(1);
  return (
    <View className="mb-2 mt-4 flex-row items-baseline justify-between px-1">
      <Text className="text-lg font-bold text-brand-700">{group.dateLabel}</Text>
      <Text className="text-xs text-gray-500">
        {group.count} הנקות • {group.totalMin} דק׳ • איכות {avgQ}/5
      </Text>
    </View>
  );
}

interface ListItem {
  type: 'header' | 'log';
  key: string;
  group?: DayGroup;
  log?: FeedingLog;
}

function flatten(groups: DayGroup[]): ListItem[] {
  const items: ListItem[] = [];
  for (const group of groups) {
    items.push({ type: 'header', key: `h-${group.dateKey}`, group });
    for (const log of group.logs) {
      items.push({ type: 'log', key: `l-${log.id}`, log });
    }
  }
  return items;
}

export default function HistoryScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<FeedingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { logs } = await api.listLogs(100);
      setLogs(logs);
    } catch (err) {
      Alert.alert('טעינה נכשלה', err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const items = useMemo(() => flatten(groupByDay(logs)), [logs]);

  return (
    <SafeAreaView className="flex-1 bg-brand-50" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <Pressable onPress={() => router.back()} className="rounded-full bg-white px-4 py-2">
          <Text className="text-sm font-semibold text-brand-700">← חזרה</Text>
        </Pressable>
        <Text className="text-2xl font-bold text-brand-700">היסטוריה</Text>
        <View className="w-16" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#DB2777" />
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-base text-gray-500">
            עדיין אין הנקות מתועדות.{'\n'}חזרי למסך הראשי כדי לתעד את הראשונה.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#DB2777" />}
          renderItem={({ item }) =>
            item.type === 'header' ? <DayHeader group={item.group!} /> : <LogRow log={item.log!} />
          }
        />
      )}
    </SafeAreaView>
  );
}
