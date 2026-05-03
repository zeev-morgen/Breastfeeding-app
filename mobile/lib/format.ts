import type { Side } from './types';

export const SIDE_LABEL: Record<Side, string> = {
  LEFT: 'שמאל',
  RIGHT: 'ימין',
  BOTH: 'שני הצדדים',
};

export function formatRelative(isoDate: string, now = new Date()): string {
  const target = new Date(isoDate);
  const diff = target.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  const phrase = hours > 0 ? `${hours} שעות ${remMins} דק׳` : `${mins} דק׳`;
  return diff >= 0 ? `בעוד ${phrase}` : `לפני ${phrase}`;
}

export function formatClock(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

export function formatShortTime(d: Date): string {
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export function isToday(isoDate: string, now = new Date()): boolean {
  const d = new Date(isoDate);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
