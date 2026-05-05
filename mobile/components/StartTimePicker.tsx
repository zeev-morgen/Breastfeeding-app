import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { composePastDate } from '@/lib/format';

interface Props {
  value: Date | null;
  onChange: (value: Date | null) => void;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PADDING = ((VISIBLE_ITEMS - 1) / 2) * ITEM_HEIGHT;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function StartTimePicker({ value, onChange }: Props) {
  const isCustom = value !== null;

  // Initial wheel position: round current time to the nearest 5-minute slot.
  const initial = useMemo(() => {
    const d = value ?? new Date();
    const hh = d.getHours();
    const mm = Math.round(d.getMinutes() / 5) * 5;
    return { hh, mm: mm === 60 ? 55 : mm };
  }, [value]);

  const [hh, setHh] = useState<number>(initial.hh);
  const [mm, setMm] = useState<number>(initial.mm);

  const switchToNow = () => {
    Haptics.selectionAsync();
    onChange(null);
  };

  const switchToCustom = () => {
    Haptics.selectionAsync();
    const now = new Date();
    const startHh = now.getHours();
    const startMm = Math.min(55, Math.round(now.getMinutes() / 5) * 5);
    setHh(startHh);
    setMm(startMm);
    onChange(composePastDate(startHh, startMm));
  };

  const updateHh = (next: number) => {
    setHh(next);
    onChange(composePastDate(next, mm));
  };
  const updateMm = (next: number) => {
    setMm(next);
    onChange(composePastDate(hh, next));
  };

  return (
    <View>
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="זמן עכשיו"
          accessibilityState={{ selected: !isCustom }}
          onPress={switchToNow}
          className={`flex-1 items-center justify-center rounded-2xl py-3 ${
            !isCustom ? 'bg-brand-600' : 'bg-brand-100'
          }`}
        >
          <Text className={`font-bold ${!isCustom ? 'text-white' : 'text-brand-700'}`}>עכשיו</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="בחירת מועד מהשעון"
          accessibilityState={{ selected: isCustom }}
          onPress={switchToCustom}
          className={`flex-1 items-center justify-center rounded-2xl py-3 ${
            isCustom ? 'bg-brand-600' : 'bg-brand-100'
          }`}
        >
          <Text className={`font-bold ${isCustom ? 'text-white' : 'text-brand-700'}`}>
            {isCustom ? `${pad(hh)}:${pad(mm)}` : 'מועד אחר'}
          </Text>
        </Pressable>
      </View>

      {isCustom ? (
        <View className="mt-3 rounded-2xl bg-brand-50 px-3 pt-3 pb-2">
          <Text className="text-center text-3xl font-bold text-brand-700">
            {pad(hh)}:{pad(mm)}
          </Text>
          <View className="mt-2 flex-row items-center justify-center gap-3">
            <WheelColumn values={HOURS} value={hh} onChange={updateHh} label="שעות" />
            <Text className="text-2xl font-bold text-brand-700">:</Text>
            <WheelColumn values={MINUTES} value={mm} onChange={updateMm} label="דקות" />
          </View>
        </View>
      ) : null}
    </View>
  );
}

interface WheelProps {
  values: number[];
  value: number;
  onChange: (next: number) => void;
  label: string;
}

function WheelColumn({ values, value, onChange, label }: WheelProps) {
  const listRef = useRef<FlatList<number>>(null);
  const initialIndex = Math.max(0, values.indexOf(value));

  const handleEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(values.length - 1, idx));
    const next = values[clamped]!;
    if (next !== value) {
      Haptics.selectionAsync();
      onChange(next);
    }
  };

  return (
    <View
      accessibilityLabel={`גלגל בחירת ${label}`}
      style={{ height: VISIBLE_ITEMS * ITEM_HEIGHT, width: 80, overflow: 'hidden' }}
    >
      <FlatList
        ref={listRef}
        data={values}
        keyExtractor={(item) => String(item)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleEnd}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        contentContainerStyle={{ paddingVertical: PADDING }}
        renderItem={({ item }) => {
          const distance = Math.abs(item - value);
          const isSelected = item === value;
          return (
            <View style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: isSelected ? 24 : 20,
                  fontWeight: isSelected ? '700' : '400',
                  color: isSelected ? '#C76A4A' : distance > 5 ? '#D1D5DB' : '#A8998F',
                }}
              >
                {pad(item)}
              </Text>
            </View>
          );
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: PADDING,
          left: 0,
          right: 0,
          height: ITEM_HEIGHT,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: '#E6DBCB',
        }}
      />
    </View>
  );
}
