import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from './api';
import type { CreateLogPayload, FeedingLog } from './types';

const QUEUE_KEY = 'lactasync.queue.v1';

/**
 * Pure-JS UUID v4 — avoids the expo-crypto native module so the offline
 * queue ships entirely via OTA on existing builds.
 */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      const pending: PendingLog[] = raw ? JSON.parse(raw) : [];
      set({ pending });
    } catch {
      // ignore hydration error — queue starts empty
    }
  },

  setOnline: (online) => {
    const wasOnline = get().isOnline;
    if (wasOnline === online) return;
    set({ isOnline: online });
    // Auto-flush whenever connectivity is restored and we have pending work.
    if (online && get().pending.length > 0) {
      void get().flush();
    }
  },

  enqueue: async (payload) => {
    const entry: PendingLog = {
      ...payload,
      localId: uuid(),
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
            // Server rejected — drop so the user isn't stuck retrying forever.
            const remaining = get().pending.filter((p) => p.localId !== entry.localId);
            set({ pending: remaining });
            await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
            failed += 1;
            // eslint-disable-next-line no-console
            console.warn('Dropping queued log rejected by server', entry.localId, err.message);
          } else {
            // Network blip / 5xx — flip back to offline, stop the loop, retry
            // on next reconnect (the next successful fetch flips us back).
            set({ isOnline: false });
            break;
          }
        }
      }
    } finally {
      set({ flushing: false });
    }

    return { sent, failed };
  },
}));

/**
 * Optimistic synthetic log built from a queued payload, so the UI can show
 * the entry immediately with a "ממתין לסנכרון" tag.
 */
export function pendingToLog(p: PendingLog, userId: string): FeedingLog {
  const startTime = p.startTime ?? new Date().toISOString();
  const endTime =
    p.durationMin > 0
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
