import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from './api';
import type { CreateLogPayload, FeedingLog } from './types';

const QUEUE_KEY = 'lactasync.queue.v1';
const PING_INTERVAL_MS = 4000;

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
  // Always populated at enqueue time so the eventual server row reflects the
  // moment the user actually tapped save — never the sync timestamp.
  startTime: string;
}

interface OfflineState {
  isOnline: boolean;
  pending: PendingLog[];
  flushing: boolean;
  hydrate: () => Promise<void>;
  enqueue: (payload: CreateLogPayload) => Promise<PendingLog>;
  updatePending: (localId: string, patch: Partial<CreateLogPayload>) => Promise<void>;
  removePending: (localId: string) => Promise<void>;
  flush: () => Promise<{ sent: number; failed: number }>;
  setOnline: (online: boolean) => void;
  startReconnectPolling: () => void;
  stopReconnectPolling: () => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

async function persistPending(pending: PendingLog[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(pending));
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
      if (pending.length > 0) {
        // If items survived from a previous session, start polling so we sync
        // the moment we discover we're online.
        get().startReconnectPolling();
      }
    } catch {
      // ignore hydration error — queue starts empty
    }
  },

  setOnline: (online) => {
    const wasOnline = get().isOnline;
    if (wasOnline === online) {
      if (online && get().pending.length > 0 && !get().flushing) {
        void get().flush();
      }
      return;
    }
    set({ isOnline: online });
    if (online) {
      get().stopReconnectPolling();
      if (get().pending.length > 0) void get().flush();
    } else if (get().pending.length > 0) {
      get().startReconnectPolling();
    }
  },

  startReconnectPolling: () => {
    if (pollTimer) return;
    pollTimer = setInterval(async () => {
      const state = get();
      if (state.isOnline || state.pending.length === 0) {
        get().stopReconnectPolling();
        return;
      }
      try {
        await api.me();
        get().setOnline(true);
      } catch {
        // still offline — keep polling
      }
    }, PING_INTERVAL_MS);
  },

  stopReconnectPolling: () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  },

  enqueue: async (payload) => {
    const entry: PendingLog = {
      ...payload,
      // Snapshot the wall-clock moment of the tap so the server row carries
      // the original time, not the sync time.
      startTime: payload.startTime ?? new Date().toISOString(),
      localId: uuid(),
      queuedAt: Date.now(),
    };
    const next = [...get().pending, entry];
    set({ pending: next });
    await persistPending(next);
    if (!get().isOnline) get().startReconnectPolling();
    return entry;
  },

  updatePending: async (localId, patch) => {
    const next = get().pending.map((p) =>
      p.localId === localId
        ? {
            ...p,
            ...patch,
            startTime: patch.startTime ?? p.startTime,
          }
        : p,
    );
    set({ pending: next });
    await persistPending(next);
  },

  removePending: async (localId) => {
    const next = get().pending.filter((p) => p.localId !== localId);
    set({ pending: next });
    await persistPending(next);
  },

  flush: async () => {
    if (get().flushing) return { sent: 0, failed: 0 };
    set({ flushing: true });

    let sent = 0;
    let failed = 0;
    let sawNetworkError = false;
    try {
      const items = [...get().pending];
      // Fire all in parallel so N items sync in ~one round-trip, not N × RTT.
      const results = await Promise.allSettled(
        items.map(async (entry) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { localId, queuedAt, ...payload } = entry;
          await api.createLog(payload);
        }),
      );

      const succeeded = new Set<string>();
      const dropped = new Set<string>();
      results.forEach((result, idx) => {
        const entry = items[idx]!;
        if (result.status === 'fulfilled') {
          succeeded.add(entry.localId);
          sent += 1;
          return;
        }
        const err = result.reason;
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          dropped.add(entry.localId);
          failed += 1;
          // eslint-disable-next-line no-console
          console.warn('Dropping queued log rejected by server', entry.localId, err.message);
        } else {
          sawNetworkError = true;
        }
      });

      const remaining = get().pending.filter(
        (p) => !succeeded.has(p.localId) && !dropped.has(p.localId),
      );
      set({ pending: remaining });
      await persistPending(remaining);

      if (sawNetworkError) {
        set({ isOnline: false });
        if (remaining.length > 0) get().startReconnectPolling();
      }
    } finally {
      set({ flushing: false });
    }

    return { sent, failed };
  },
}));

/**
 * Optimistic synthetic log built from a queued payload, so the UI can show
 * the entry immediately with a "ממתין לסנכרון" tag. startTime is always set
 * at enqueue time so the row time is stable across re-renders and sync.
 */
export function pendingToLog(p: PendingLog, userId: string): FeedingLog {
  const endTime =
    p.durationMin > 0
      ? new Date(new Date(p.startTime).getTime() + p.durationMin * 60_000).toISOString()
      : null;
  return {
    id: p.localId,
    userId,
    side: p.side,
    qualityScore: p.qualityScore,
    durationMin: p.durationMin,
    startTime: p.startTime,
    endTime,
    notes: p.notes ?? null,
    source: 'APP',
    createdAt: new Date(p.queuedAt).toISOString(),
    updatedAt: new Date(p.queuedAt).toISOString(),
    pending: true,
  };
}
