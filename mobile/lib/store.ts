import { create } from 'zustand';
import { api, getToken, setToken } from './api';
import type { AuthUser } from './types';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  hydrated: false,

  hydrate: async () => {
    const token = await getToken();
    if (!token) {
      set({ hydrated: true });
      return;
    }
    try {
      const { user } = await api.me();
      set({ user, token, hydrated: true });
    } catch {
      await setToken(null);
      set({ hydrated: true });
    }
  },

  login: async (email, password) => {
    const { token, user } = await api.login(email, password);
    await setToken(token);
    set({ user, token });
  },

  signOut: async () => {
    await setToken(null);
    set({ user: null, token: null });
  },
}));
