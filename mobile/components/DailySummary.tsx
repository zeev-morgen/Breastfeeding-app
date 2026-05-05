import { StyleSheet, Text, View } from 'react-native';
import type { FeedingLog } from '@/lib/types';

interface Props {
  logs: FeedingLog[];
}

export function DailySummary({ logs }: Props) {
  const count = logs.length;
  const avgQuality = count ? logs.reduce((acc, l) => acc + l.qualityScore, 0) / count : 0;

  if (count === 0) return null;

  return (
    <View style={s.card}>
      <Text style={s.sectionLabel}>סיכום היום</Text>
      <View style={s.statsRow}>
        <Stat value={String(count)} label="הנקות היום" />
        <View style={s.divider} />
        <Stat value={avgQuality.toFixed(1)} label="איכות ממוצעת" />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FBF6EE',
    borderRadius: 20,
    padding: 18,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#6B5A50',
    textTransform: 'uppercase',
    marginBottom: 10,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: '#E6DBCB',
    marginHorizontal: 16,
  },
  stat: {
    flex: 1,
  },
  statValue: {
    fontFamily: 'serif',
    fontSize: 28,
    color: '#2B1F1A',
    lineHeight: 32,
    textAlign: 'right',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B5A50',
    marginTop: 2,
    letterSpacing: 0.3,
    textAlign: 'right',
  },
});
