import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  const fg = selected ? '#FBF6EE' : '#2B1F1A';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`בחירת צד ${LABEL[side]}`}
      accessibilityState={{ selected }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress(side);
      }}
      style={({ pressed }) => [s.btn, selected ? s.selected : s.unselected, pressed && { opacity: 0.88 }]}
    >
      {/* Abstract breast glyph */}
      <View style={[s.glyphWrap, side === 'RIGHT' && { transform: [{ scaleX: -1 }] }]}>
        <View style={[s.glyphOuter, { borderColor: fg }]} />
        <View style={[s.glyphDot, { backgroundColor: fg }]} />
      </View>

      <Text style={[s.label, { color: fg }]}>{LABEL[side]}</Text>

      {recommended && !selected && (
        <View style={s.badge}>
          <Text style={s.badgeText}>מומלץ</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  selected: { backgroundColor: '#2B1F1A' },
  unselected: { backgroundColor: '#F4ECE2' },
  glyphWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphOuter: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  glyphDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    bottom: 3,
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: 12,
    backgroundColor: '#7A8C6F',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 9,
    color: '#FBF6EE',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
});
