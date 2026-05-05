import { Text, View } from 'react-native';
import type { FeedingLog } from '@/lib/types';

interface Props {
  logs: FeedingLog[];
}

export function DailySummary({ logs }: Props) {
  const count = logs.length;
  const avgQuality = count ? logs.reduce((s, l) => s + l.qualityScore, 0) / count : 0;

  return (
    <View className="rounded-3xl bg-white p-5">
      <Text className="text-xs font-semibold uppercase tracking-wide text-brand-600">סיכום היום</Text>
      {count === 0 ? (
        <Text className="mt-2 text-sm text-gray-500">עדיין אין הנקות מתועדות היום.</Text>
      ) : (
        <View className="mt-2 flex-row gap-4">
          <Stat value={String(count)} label="הנקות" />
          <Stat value={`${avgQuality.toFixed(1)}/5`} label="איכות ממוצעת" />
        </View>
      )}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1">
      <Text className="text-2xl font-bold text-gray-900">{value}</Text>
      <Text className="text-xs text-gray-500">{label}</Text>
    </View>
  );
}
