import { StyleSheet, Text, View } from 'react-native';
import type { FeedingLog } from '@/lib/types';
import { SIDE_LABEL, formatClock } from '@/lib/format';

interface DayGroup {
  dateKey: string;
  dateLabel: string;
  count: number;
  qualitySum: number;
  logs: FeedingLog[];
}

const DAY_FORMATTER = new Intl.DateTimeFormat('he-IL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const target = new Date(iso);
  const now = new Date();
  if (
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()
  ) {
    return 'היום';
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    target.getFullYear() === yesterday.getFullYear() &&
    target.getMonth() === yesterday.getMonth() &&
    target.getDate() === yesterday.getDate()
  ) {
    return 'אתמול';
  }
  return DAY_FORMATTER.format(target);
}

function groupByDay(logs: FeedingLog[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const log of logs) {
    const key = dayKey(log.startTime);
    const existing = map.get(key);
    if (existing) {
      existing.logs.push(log);
      existing.qualitySum += log.qualityScore;
      existing.count += 1;
    } else {
      map.set(key, {
        dateKey: key,
        dateLabel: dayLabel(log.startTime),
        qualitySum: log.qualityScore,
        count: 1,
        logs: [log],
      });
    }
  }
  return Array.from(map.values());
}

function QualityDots({ score }: { score: number }) {
  return (
    <View style={s.dotsRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View key={n} style={[s.dot, n <= score ? s.dotFilled : s.dotEmpty]} />
      ))}
    </View>
  );
}

function LogRow({ log }: { log: FeedingLog }) {
  return (
    <View style={s.logRow}>
      {/* Time */}
      <Text style={s.logTime}>{formatClock(log.startTime)}</Text>
      <View style={s.logDivider} />
      {/* Side + note */}
      <View style={s.logBody}>
        <View style={s.logTitleRow}>
          <Text style={s.logSide}>{SIDE_LABEL[log.side]}</Text>
          {log.pending && (
            <Text style={s.pendingLabel}>· ממתין לסנכרון</Text>
          )}
        </View>
      </View>
      {/* Quality dots */}
      <QualityDots score={log.qualityScore} />
    </View>
  );
}

function DayHeader({ group }: { group: DayGroup }) {
  const avgQ = (group.qualitySum / group.count).toFixed(1);
  return (
    <View style={s.dayHeader}>
      <Text style={s.dayLabel}>{group.dateLabel}</Text>
      <Text style={s.daySummary}>
        {group.count} הנקות · איכות {avgQ}
      </Text>
    </View>
  );
}

interface Props {
  logs: FeedingLog[];
  emptyMessage?: string;
}

export function HistoryList({ logs, emptyMessage = 'עדיין אין הנקות מתועדות.' }: Props) {
  if (logs.length === 0) {
    return (
      <View style={s.emptyWrap}>
        <Text style={s.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }
  const groups = groupByDay(logs);
  return (
    <View>
      {groups.map((g) => (
        <View key={g.dateKey}>
          <DayHeader group={g} />
          {g.logs.map((log) => (
            <LogRow key={log.id} log={log} />
          ))}
        </View>
      ))}
    </View>
  );
}

const SURFACE = '#FBF6EE';
const INK = '#2B1F1A';
const INK_SOFT = '#6B5A50';
const PRIMARY = '#C76A4A';
const LINE = '#E6DBCB';

const s = StyleSheet.create({
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
    marginTop: 18,
    paddingHorizontal: 2,
  },
  dayLabel: {
    fontFamily: 'serif',
    fontSize: 20,
    color: INK,
    fontWeight: '500',
  },
  daySummary: {
    fontSize: 11,
    color: INK_SOFT,
  },
  logRow: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logTime: {
    fontFamily: 'serif',
    fontSize: 17,
    color: INK,
    width: 48,
    textAlign: 'right',
  },
  logDivider: {
    width: 1,
    height: 32,
    backgroundColor: LINE,
  },
  logBody: {
    flex: 1,
  },
  logTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
  },
  logSide: {
    fontSize: 14,
    color: INK,
    fontWeight: '600',
    textAlign: 'right',
  },
  pendingLabel: {
    fontSize: 10,
    color: INK_SOFT,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotFilled: { backgroundColor: PRIMARY },
  dotEmpty: { backgroundColor: LINE },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 14,
    color: INK_SOFT,
    textAlign: 'center',
    lineHeight: 20,
  },
});
