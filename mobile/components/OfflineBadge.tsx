import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface Props {
  isOnline: boolean;
  pendingCount: number;
  flushing: boolean;
}

export function OfflineBadge({ isOnline, pendingCount, flushing }: Props) {
  if (!isOnline) {
    return (
      <View style={s.badge}>
        <View style={[s.dot, { backgroundColor: '#9CA3AF' }]} />
        <Text style={[s.text, { color: '#6B7280' }]}>
          מצב לא מקוון{pendingCount > 0 ? ` · ${pendingCount} ממתינות` : ''}
        </Text>
      </View>
    );
  }
  if (flushing && pendingCount > 0) {
    return (
      <View style={[s.badge, s.badgeSyncing]}>
        <ActivityIndicator size="small" color="#C76A4A" />
        <Text style={[s.text, { color: '#B05A3C' }]}>מסנכרן {pendingCount} הנקות…</Text>
      </View>
    );
  }
  return null;
}

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: '#F4ECE2',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E6DBCB',
  },
  badgeSyncing: {
    backgroundColor: '#EAD0BF',
    borderColor: '#D9906A',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
