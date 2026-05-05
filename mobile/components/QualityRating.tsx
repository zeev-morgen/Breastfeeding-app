import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Props {
  value: number;
  onChange: (value: number) => void;
}

const QUALITY_LABELS: Record<number, string> = {
  1: 'קשה',
  2: 'בינוני',
  3: 'טוב',
  4: 'רגוע',
  5: 'מושלם',
};

export function QualityRating({ value, onChange }: Props) {
  return (
    <View>
      <View style={s.labelRow}>
        <Text style={s.labelLeft}>איכות ההנקה</Text>
        <Text style={s.labelRight}>
          {value} / 5 · {QUALITY_LABELS[value] ?? ''}
        </Text>
      </View>
      <View style={s.bars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`איכות ${n} מתוך 5`}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(n);
            }}
            style={[s.bar, n <= value ? s.barActive : s.barInactive]}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelLeft: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#6B5A50',
    textTransform: 'uppercase',
  },
  labelRight: {
    fontSize: 12,
    color: '#2B1F1A',
    fontWeight: '600',
  },
  bars: {
    flexDirection: 'row',
    gap: 6,
  },
  bar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  barActive: {
    backgroundColor: '#C76A4A',
  },
  barInactive: {
    backgroundColor: '#E6DBCB',
  },
});
