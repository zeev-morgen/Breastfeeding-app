import { create } from 'zustand';
import { api, ApiError, getToken, getUser, setToken, setUser } from './api';
import type { AuthUser } from './types';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; displayName?: string; phoneE164?: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  hydrated: false,

  hydrate: async () => {
    const [token, cachedUser] = await Promise.all([getToken(), getUser()]);
    if (!token) {
      set({ hydrated: true });
      return;
    }
    // Trust the local token immediately so the user lands on the home screen
    // even when offline. We then validate against the server in the background
    // and only sign out if the server explicitly says the token is invalid.
    set({ user: cachedUser, token, hydrated: true });
    try {
      const { user } = await api.me();
      await setUser(user);
      set({ user });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await setToken(null);
        await setUser(null);
        set({ user: null, token: null });
      }
      // Network errors / 5xx — stay logged in from cache. The next successful
      // refresh will reconcile.
    }
  },

  login: async (email, password) => {
    const { token, user } = await api.login(email, password);
    await Promise.all([setToken(token), setUser(user)]);
    set({ user, token });
  },

  register: async (input) => {
    const { token, user } = await api.register(input);
    await Promise.all([setToken(token), setUser(user)]);
    set({ user, token });
  },

  signOut: async () => {
    await Promise.all([setToken(null), setUser(null)]);
    set({ user: null, token: null });
  },
}));
