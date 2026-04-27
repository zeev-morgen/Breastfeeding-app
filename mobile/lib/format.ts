import type { Side } from './types';

export const SIDE_LABEL: Record<Side, string> = {
  LEFT: 'Left',
  RIGHT: 'Right',
  BOTH: 'Both',
};

export function formatRelative(isoDate: string, now = new Date()): string {
  const target = new Date(isoDate);
  const diff = target.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  const phrase = hours > 0 ? `${hours}h ${remMins}m` : `${mins}m`;
  return diff >= 0 ? `in ${phrase}` : `${phrase} ago`;
}

export function formatClock(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
