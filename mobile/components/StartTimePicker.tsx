import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { formatShortDate, formatShortTime } from '@/lib/format';

interface Props {
  value: Date | null;
  onChange: (value: Date | null) => void;
}

export function StartTimePicker({ value, onChange }: Props) {
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [draft, setDraft] = useState<Date>(value ?? new Date());

  const isCustom = value !== null;

  const startCustomFlow = () => {
    setDraft(value ?? new Date());
    setShowDate(true);
  };

  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowDate(false);
    if (event.type === 'dismissed' || !selected) return;
    const next = new Date(draft);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    setDraft(next);
    setShowTime(true);
  };

  const handleTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowTime(false);
    if (event.type === 'dismissed' || !selected) return;
    const final = new Date(draft);
    final.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    onChange(final);
  };

  return (
    <View>
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="זמן עכשיו"
          accessibilityState={{ selected: !isCustom }}
          onPress={() => onChange(null)}
          className={`flex-1 items-center justify-center rounded-2xl py-3 ${
            !isCustom ? 'bg-brand-600' : 'bg-brand-100'
          }`}
        >
          <Text className={`font-bold ${!isCustom ? 'text-white' : 'text-brand-700'}`}>עכשיו</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="בחירת מועד"
          accessibilityState={{ selected: isCustom }}
          onPress={startCustomFlow}
          className={`flex-1 items-center justify-center rounded-2xl py-3 ${
            isCustom ? 'bg-brand-600' : 'bg-brand-100'
          }`}
        >
          <Text className={`font-bold ${isCustom ? 'text-white' : 'text-brand-700'}`}>
            {isCustom && value ? `${formatShortDate(value)} • ${formatShortTime(value)}` : 'מועד אחר'}
          </Text>
        </Pressable>
      </View>

      {showDate ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={handleDateChange}
        />
      ) : null}

      {showTime ? (
        <DateTimePicker
          value={draft}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          is24Hour
          onChange={handleTimeChange}
        />
      ) : null}
    </View>
  );
}
