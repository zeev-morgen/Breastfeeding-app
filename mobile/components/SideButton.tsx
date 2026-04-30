import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Side } from '@/lib/types';

interface Props {
  side: Side;
  selected: boolean;
  recommended?: boolean;
  onPress: (side: Side) => void;
}

const LABEL: Record<Side, string> = { LEFT: 'שמאל', RIGHT: 'ימין', BOTH: 'שניהם' };

export function SideButton({ side, selected, recommended, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`בחירת צד ${LABEL[side]}`}
      accessibilityState={{ selected }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress(side);
      }}
      className={`flex-1 items-center justify-center rounded-3xl py-6 ${
        selected ? 'bg-brand-600' : 'bg-brand-100'
      }`}
    >
      <Text className={`text-2xl font-bold ${selected ? 'text-white' : 'text-brand-700'}`}>{LABEL[side]}</Text>
      {recommended && !selected ? (
        <View className="mt-1 rounded-full bg-brand-200 px-2 py-0.5">
          <Text className="text-[10px] font-semibold tracking-wide text-brand-700">מומלץ</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
