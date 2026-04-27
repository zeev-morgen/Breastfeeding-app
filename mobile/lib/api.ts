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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
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
