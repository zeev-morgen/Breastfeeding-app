import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
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

const SIDE_BG: Record<string, string> = {
  LEFT: 'bg-pink-100',
  RIGHT: 'bg-purple-100',
  BOTH: 'bg-amber-100',
};

const SIDE_DOT: Record<string, string> = {
  LEFT: 'bg-pink-500',
  RIGHT: 'bg-purple-500',
  BOTH: 'bg-amber-500',
};

function QualityBadge({ score }: { score: number }) {
  const stars = '★'.repeat(score) + '☆'.repeat(5 - score);
  return <Text className="text-xs text-amber-500">{stars}</Text>;
}

function LogRow({ log, onPress }: { log: FeedingLog; onPress?: (log: FeedingLog) => void }) {
  const content = (
    <>
      <View className={`h-12 w-12 items-center justify-center rounded-2xl ${SIDE_BG[log.side]}`}>
        <View className={`h-2 w-2 rounded-full ${SIDE_DOT[log.side]}`} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-baseline gap-2">
          <Text className="text-base font-semibold text-gray-900">{SIDE_LABEL[log.side]}</Text>
          {log.pending ? (
            <Text className="text-[10px] font-semibold text-gray-400">ממתין לסנכרון</Text>
          ) : null}
        </View>
        <View className="mt-0.5 flex-row items-center gap-2">
          <Text className="text-xs text-gray-500">{formatClock(log.startTime)}</Text>
          <QualityBadge score={log.qualityScore} />
        </View>
      </View>
      {onPress ? <Text className="text-xs text-gray-300">›</Text> : null}
    </>
  );

  if (!onPress) {
    return <View className="mb-2 flex-row items-center gap-3 rounded-2xl bg-white p-4">{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`עריכת הנקה ${SIDE_LABEL[log.side]} בשעה ${formatClock(log.startTime)}`}
      onPress={() => {
        Haptics.selectionAsync();
        onPress(log);
      }}
      className="mb-2 flex-row items-center gap-3 rounded-2xl bg-white p-4"
    >
      {content}
    </Pressable>
  );
}

function DayHeader({ group }: { group: DayGroup }) {
  const avgQ = (group.qualitySum / group.count).toFixed(1);
  return (
    <View className="mb-2 mt-4 flex-row items-baseline justify-between px-1">
      <Text className="text-lg font-bold text-brand-700">{group.dateLabel}</Text>
      <Text className="text-xs text-gray-500">
        {group.count} הנקות • איכות {avgQ}/5
      </Text>
    </View>
  );
}

interface Props {
  logs: FeedingLog[];
  emptyMessage?: string;
  onPressLog?: (log: FeedingLog) => void;
}

export function HistoryList({ logs, emptyMessage = 'עדיין אין הנקות מתועדות.', onPressLog }: Props) {
  if (logs.length === 0) {
    return (
      <View className="items-center px-4 py-6">
        <Text className="text-center text-sm text-gray-500">{emptyMessage}</Text>
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
            <LogRow key={log.id} log={log} onPress={onPressLog} />
          ))}
        </View>
      ))}
    </View>
  );
}
