import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Props {
  value: Date | null;
  onChange: (value: Date | null) => void;
}

const HOURS_MAX = 12;
const MINUTES_STEP = 5;
const MINUTES_MAX = 55;
const DEFAULT_MIN_AGO = 30;

export function StartTimePicker({ value, onChange }: Props) {
  const isCustom = value !== null;

  // Track the offset locally so successive +/- presses operate on the same
  // baseline — rebuilding it from `value` would re-anchor every render to "now".
  const [hoursAgo, setHoursAgo] = useState(0);
  const [minutesAgo, setMinutesAgo] = useState(DEFAULT_MIN_AGO);

  const emit = (h: number, m: number) => {
    const totalMin = h * 60 + m;
    onChange(new Date(Date.now() - totalMin * 60_000));
  };

  const switchToNow = () => {
    Haptics.selectionAsync();
    onChange(null);
  };

  const switchToCustom = () => {
    Haptics.selectionAsync();
    setHoursAgo(0);
    setMinutesAgo(DEFAULT_MIN_AGO);
    emit(0, DEFAULT_MIN_AGO);
  };

  const setHours = (next: number) => {
    Haptics.selectionAsync();
    const clamped = Math.max(0, Math.min(HOURS_MAX, next));
    setHoursAgo(clamped);
    emit(clamped, minutesAgo);
  };

  const setMinutes = (next: number) => {
    Haptics.selectionAsync();
    const clamped = Math.max(0, Math.min(MINUTES_MAX, next));
    setMinutesAgo(clamped);
    emit(hoursAgo, clamped);
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
          accessibilityLabel="דיווח רטרואקטיבי"
          accessibilityState={{ selected: isCustom }}
          onPress={switchToCustom}
          className={`flex-1 items-center justify-center rounded-2xl py-3 ${
            isCustom ? 'bg-brand-600' : 'bg-brand-100'
          }`}
        >
          <Text className={`font-bold ${isCustom ? 'text-white' : 'text-brand-700'}`}>מועד אחר</Text>
        </Pressable>
      </View>

      {isCustom ? (
        <View className="mt-3 rounded-2xl bg-brand-50 p-3">
          <Text className="text-center text-xs font-semibold tracking-wide text-brand-700">לפני</Text>
          <View className="mt-2 flex-row gap-2">
            <OffsetStepper label="שעות" value={hoursAgo} onChange={setHours} step={1} max={HOURS_MAX} />
            <OffsetStepper label="דקות" value={minutesAgo} onChange={setMinutes} step={MINUTES_STEP} max={MINUTES_MAX} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

interface OffsetStepperProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step: number;
  max: number;
}

function OffsetStepper({ label, value, onChange, step, max }: OffsetStepperProps) {
  return (
    <View className="flex-1 flex-row items-center justify-between rounded-2xl bg-white p-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`הפחתת ${label}`}
        onPress={() => onChange(Math.max(0, value - step))}
        className="h-10 w-10 items-center justify-center rounded-full bg-brand-100"
      >
        <Text className="text-xl font-bold text-brand-700">−</Text>
      </Pressable>
      <View className="items-center">
        <Text className="text-xl font-bold text-brand-700">{value}</Text>
        <Text className="text-[10px] tracking-wide text-brand-700">{label}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`הוספת ${label}`}
        onPress={() => onChange(Math.min(max, value + step))}
        className="h-10 w-10 items-center justify-center rounded-full bg-brand-100"
      >
        <Text className="text-xl font-bold text-brand-700">+</Text>
      </Pressable>
    </View>
  );
}
