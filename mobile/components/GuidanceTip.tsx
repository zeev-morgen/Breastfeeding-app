import { Text, View } from 'react-native';

export function GuidanceTip({ tip }: { tip: string | null }) {
  if (!tip) return null;
  return (
    <View className="flex-row gap-3 rounded-3xl bg-amber-50 p-4">
      <Text className="text-2xl">💡</Text>
      <View className="flex-1">
        <Text className="text-xs font-semibold uppercase tracking-wide text-amber-700">Tip</Text>
        <Text className="mt-1 text-sm leading-5 text-amber-900">{tip}</Text>
      </View>
    </View>
  );
}
