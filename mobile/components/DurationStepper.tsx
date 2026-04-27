import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Props {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

export function DurationStepper({ value, onChange, step = 5, min = 0, max = 90 }: Props) {
  const set = (next: number) => {
    Haptics.selectionAsync();
    onChange(Math.max(min, Math.min(max, next)));
  };
  return (
    <View className="flex-row items-center justify-between rounded-3xl bg-brand-100 p-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease duration"
        onPress={() => set(value - step)}
        className="h-14 w-14 items-center justify-center rounded-full bg-white"
      >
        <Text className="text-3xl font-bold text-brand-700">−</Text>
      </Pressable>
      <View className="items-center">
        <Text className="text-4xl font-bold text-brand-700">{value}</Text>
        <Text className="text-xs uppercase tracking-wide text-brand-700">minutes</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase duration"
        onPress={() => set(value + step)}
        className="h-14 w-14 items-center justify-center rounded-full bg-white"
      >
        <Text className="text-3xl font-bold text-brand-700">+</Text>
      </Pressable>
    </View>
  );
}
