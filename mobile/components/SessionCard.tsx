import { Text, View } from 'react-native';
import type { FeedingLog, Guidance } from '@/lib/types';
import { SIDE_LABEL, formatClock, formatRelative } from '@/lib/format';

interface Props {
  latest: FeedingLog | null;
  guidance: Guidance;
}

export function SessionCard({ latest, guidance }: Props) {
  return (
    <View className="rounded-3xl bg-white p-5 shadow-sm">
      <Text className="text-xs font-semibold uppercase tracking-wide text-brand-600">Last session</Text>
      {latest ? (
        <View className="mt-1 flex-row items-baseline gap-2">
          <Text className="text-2xl font-bold text-gray-900">{SIDE_LABEL[latest.side]}</Text>
          <Text className="text-base text-gray-600">
            • {latest.durationMin} min • {latest.qualityScore}/5
          </Text>
        </View>
      ) : (
        <Text className="mt-1 text-base text-gray-500">No sessions yet — log your first below.</Text>
      )}
      {latest ? (
        <Text className="mt-1 text-sm text-gray-500">{formatRelative(latest.startTime)}</Text>
      ) : null}

      <View className="mt-4 border-t border-gray-100 pt-3">
        <Text className="text-xs font-semibold uppercase tracking-wide text-brand-600">Next feeding</Text>
        <Text className="mt-1 text-base text-gray-900">
          {SIDE_LABEL[guidance.nextSide]} side around {formatClock(guidance.nextFeedingAt)} (
          {formatRelative(guidance.nextFeedingAt)})
        </Text>
      </View>
    </View>
  );
}
