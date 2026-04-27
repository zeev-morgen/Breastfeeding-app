import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Props {
  value: number;
  onChange: (value: number) => void;
}

export function QualityRating({ value, onChange }: Props) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= value;
        return (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`Quality ${n} of 5`}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(n);
            }}
            className={`h-14 w-14 items-center justify-center rounded-full ${
              active ? 'bg-brand-500' : 'bg-brand-100'
            }`}
          >
            <Text className={`text-xl font-bold ${active ? 'text-white' : 'text-brand-700'}`}>{n}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
