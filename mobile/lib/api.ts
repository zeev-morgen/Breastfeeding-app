import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthUser, CreateLogPayload, FeedingLog, Guidance } from './types';

const TOKEN_KEY = 'lactasync.token';

export const apiBaseUrl: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? 'http://localhost:4000';

export async function setToken(token: string | null) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        // Bypass ngrok-free browser warning HTML interstitial.
        'ngrok-skip-browser-warning': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(0, `אין תגובה מהשרת (${apiBaseUrl}). בדקי חיבור או כתובת.`);
    }
    throw new ApiError(0, `שגיאת רשת: ${err instanceof Error ? err.message : 'unknown'}`);
  } finally {
    clearTimeout(timeout);
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, body?.message ?? `Request failed: ${res.status}`, body);
  }
  return body as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (input: { email: string; password: string; displayName?: string; phoneE164?: string }) =>
    request<{ token: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  me: () => request<{ user: AuthUser }>('/api/auth/me'),

  createLog: (input: CreateLogPayload) =>
    request<{ log: FeedingLog; guidance: Guidance }>('/api/logs', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getLatest: () => request<{ log: FeedingLog | null; guidance: Guidance }>('/api/logs/latest'),

  listLogs: (limit = 20) => request<{ logs: FeedingLog[] }>(`/api/logs?limit=${limit}`),
};

export { ApiError };
