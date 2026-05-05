import { ActivityIndicator, Text, View } from 'react-native';

interface Props {
  isOnline: boolean;
  pendingCount: number;
  flushing: boolean;
}

export function OfflineBadge({ isOnline, pendingCount, flushing }: Props) {
  if (!isOnline) {
    return (
      <View className="self-center rounded-full bg-gray-200 px-3 py-1">
        <Text className="text-xs font-semibold text-gray-700">
          מצב לא מקוון{pendingCount > 0 ? ` • ${pendingCount} ממתינות` : ''}
        </Text>
      </View>
    );
  }
  if (flushing && pendingCount > 0) {
    return (
      <View className="flex-row items-center gap-2 self-center rounded-full bg-brand-100 px-3 py-1">
        <ActivityIndicator size="small" color="#BE185D" />
        <Text className="text-xs font-semibold text-brand-700">מסנכרן {pendingCount} הנקות…</Text>
      </View>
    );
  }
  return null;
}
