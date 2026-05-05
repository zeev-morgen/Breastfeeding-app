import { StyleSheet, Text, View } from 'react-native';

export function GuidanceTip({ tip }: { tip: string | null }) {
  if (!tip) return null;
  return (
    <View style={s.card}>
      <View style={s.iconWrap}>
        <Text style={s.icon}>♡</Text>
      </View>
      <View style={s.body}>
        <Text style={s.label}>טיפ</Text>
        <Text style={s.text}>{tip}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#D9DFCE',
    borderRadius: 20,
    padding: 16,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7A8C6F',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  icon: {
    fontSize: 14,
    color: '#FBF6EE',
  },
  body: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#5E6F55',
    textTransform: 'uppercase',
    marginBottom: 4,
    textAlign: 'right',
  },
  text: {
    fontSize: 14,
    color: '#23291F',
    lineHeight: 21,
    textAlign: 'right',
  },
});
