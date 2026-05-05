import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { api, ApiError } from './api';
import { getInitialOnline, subscribeOnline } from './network';
import type { CreateLogPayload, FeedingLog } from './types';

const QUEUE_KEY = 'lactasync.queue.v1';

export interface PendingLog extends CreateLogPayload {
  localId: string;
  queuedAt: number;
}

interface OfflineState {
  isOnline: boolean;
  pending: PendingLog[];
  flushing: boolean;
  hydrate: () => Promise<void>;
  enqueue: (payload: CreateLogPayload) => Promise<PendingLog>;
  flush: () => Promise<{ sent: number; failed: number }>;
  setOnline: (online: boolean) => void;
}

export const useOfflineQueue = create<OfflineState>((set, get) => ({
  isOnline: true,
  pending: [],
  flushing: false,

  hydrate: async () => {
    const [raw, online] = await Promise.all([
      AsyncStorage.getItem(QUEUE_KEY),
      getInitialOnline(),
    ]);
    const pending: PendingLog[] = raw ? JSON.parse(raw) : [];
    set({ pending, isOnline: online });

    subscribeOnline((next) => {
      const wasOnline = get().isOnline;
      set({ isOnline: next });
      if (next && !wasOnline && get().pending.length > 0) {
        void get().flush();
      }
    });

    if (online && pending.length > 0) {
      void get().flush();
    }
  },

  enqueue: async (payload) => {
    const entry: PendingLog = {
      ...payload,
      localId: Crypto.randomUUID(),
      queuedAt: Date.now(),
    };
    const next = [...get().pending, entry];
    set({ pending: next });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next));
    return entry;
  },

  flush: async () => {
    if (get().flushing) return { sent: 0, failed: 0 };
    set({ flushing: true });

    let sent = 0;
    let failed = 0;
    try {
      // Snapshot at start; new items added concurrently will be flushed on
      // the next tick (their own enqueue will call flush again if online).
      for (const entry of [...get().pending]) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { localId, queuedAt, ...payload } = entry;
          await api.createLog(payload);
          const remaining = get().pending.filter((p) => p.localId !== entry.localId);
          set({ pending: remaining });
          await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
          sent += 1;
        } catch (err) {
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
            // Server rejected the payload (validation, auth) — drop so we
            // don't retry forever. Surface to the user via a console log;
            // the screen will refetch and the row simply won't reappear.
            const remaining = get().pending.filter((p) => p.localId !== entry.localId);
            set({ pending: remaining });
            await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
            failed += 1;
            // eslint-disable-next-line no-console
            console.warn('Dropping queued log rejected by server', entry.localId, err.message);
          } else {
            // Network blip / 5xx — keep in queue, stop the loop, retry next
            // reconnect. Avoids burning the queue on a transient outage.
            break;
          }
        }
      }
    } finally {
      set({ flushing: false });
    }

    return { sent, failed };
  },

  setOnline: (online) => set({ isOnline: online }),
}));

/**
 * Optimistic synthetic log built from a queued payload, so the UI can show
 * the entry immediately with a "ממתין לסנכרון" tag.
 */
export function pendingToLog(p: PendingLog, userId: string): FeedingLog {
  const startTime = p.startTime ?? new Date().toISOString();
  const endTime = p.durationMin > 0
    ? new Date(new Date(startTime).getTime() + p.durationMin * 60_000).toISOString()
    : null;
  return {
    id: p.localId,
    userId,
    side: p.side,
    qualityScore: p.qualityScore,
    durationMin: p.durationMin,
    startTime,
    endTime,
    notes: p.notes ?? null,
    source: 'APP',
    createdAt: new Date(p.queuedAt).toISOString(),
    updatedAt: new Date(p.queuedAt).toISOString(),
    pending: true,
  };
}
