import { StyleSheet, Text, View } from 'react-native';
import type { FeedingLog, Guidance } from '@/lib/types';
import { SIDE_LABEL, formatClock, formatRelative } from '@/lib/format';

interface Props {
  latest: FeedingLog | null;
  guidance: Guidance;
}

function QualityDots({ score }: { score: number }) {
  return (
    <View style={s.dotsRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View
          key={n}
          style={[s.dot, n <= score ? s.dotFilled : s.dotEmpty]}
        />
      ))}
    </View>
  );
}

export function SessionCard({ latest, guidance }: Props) {
  return (
    <View style={s.card}>
      {/* Last feeding */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>ההנקה האחרונה</Text>
        {latest ? (
          <View style={s.lastRow}>
            <View style={s.lastLeft}>
              <Text style={s.sideText}>{SIDE_LABEL[latest.side]}</Text>
              <Text style={s.timeText}>{formatRelative(latest.startTime)}</Text>
            </View>
            <QualityDots score={latest.qualityScore} />
          </View>
        ) : (
          <Text style={s.emptyText}>עדיין אין הנקות — תיעוד ראשון למטה.</Text>
        )}
      </View>

      <View style={s.divider} />

      {/* Next feeding */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>ההנקה הבאה — בערך</Text>
        <View style={s.nextRow}>
          <View style={s.nextLeft}>
            <Text style={s.nextSide}>
              <Text style={s.nextSideAccent}>{SIDE_LABEL[guidance.nextSide]}</Text>
              {' · '}
              {formatClock(guidance.nextFeedingAt)}
            </Text>
            <Text style={s.nextRelative}>{formatRelative(guidance.nextFeedingAt)}</Text>
          </View>
          {/* Countdown ring - simplified View */}
          <View style={s.ring}>
            <Text style={s.ringLabel}>
              {Math.max(0, Math.round((new Date(guidance.nextFeedingAt).getTime() - Date.now()) / 60000))}′
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const SURFACE = '#FBF6EE';
const INK = '#2B1F1A';
const INK_SOFT = '#6B5A50';
const PRIMARY = '#C76A4A';
const LINE = '#E6DBCB';

const s = StyleSheet.create({
  card: {
    backgroundColor: SURFACE,
    borderRadius: 24,
    padding: 20,
  },
  section: {},
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: INK_SOFT,
    textTransform: 'uppercase',
    marginBottom: 6,
    textAlign: 'right',
  },
  lastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastLeft: {},
  sideText: {
    fontFamily: 'serif',
    fontSize: 26,
    color: INK,
    fontWeight: '500',
    textAlign: 'right',
  },
  timeText: {
    fontSize: 13,
    color: INK_SOFT,
    marginTop: 2,
    textAlign: 'right',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotFilled: { backgroundColor: PRIMARY },
  dotEmpty: { backgroundColor: LINE },
  emptyText: {
    fontSize: 14,
    color: INK_SOFT,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: LINE,
    marginVertical: 14,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextLeft: {},
  nextSide: {
    fontFamily: 'serif',
    fontSize: 20,
    color: INK,
    fontWeight: '500',
    textAlign: 'right',
  },
  nextSideAccent: {
    color: PRIMARY,
    fontStyle: 'italic',
  },
  nextRelative: {
    fontSize: 12,
    color: INK_SOFT,
    marginTop: 2,
    textAlign: 'right',
  },
  ring: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: INK,
  },
});
