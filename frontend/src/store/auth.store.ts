import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { apiClient } from '@/lib/api-client';

// ─── Storage en cookie ──────────────────────────────────────────────────────
// El middleware (server-side) necesita leer el estado de auth desde una
// cookie, ya que no tiene acceso a localStorage. Por eso persistimos el
// estado de zustand en una cookie en vez del storage por defecto.
const COOKIE_NAME = 'trustscore-auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

const cookieStorage: StateStorage = {
  getItem: (name) => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  },
  setItem: (name, value) => {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  },
  removeItem: (name) => {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=; path=/; max-age=0`;
  },
};

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  setAuth: (user: AuthUser, token: string, refreshToken: string) => void;
  clearAuth: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role?: string, company_name?: string, domain?: string) => Promise<void>;
  refreshAccess: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setAuth: (user, token, refreshToken) => {
        apiClient.setToken(token);
        set({ user, token, refreshToken, isAuthenticated: true, error: null });
      },

      clearAuth: () => {
        apiClient.setToken(null);
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false, error: null });
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await apiClient.post<{ access_token: string; refresh_token: string }>(
            '/auth/login',
            { email, password }
          );
          // Decode JWT to get user info
          const payload = JSON.parse(atob(res.access_token.split('.')[1]));
          const user: AuthUser = { id: payload.sub, name: payload.name || email, email: payload.email, role: payload.role };
          get().setAuth(user, res.access_token, res.refresh_token);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error al iniciar sesión';
          set({ error: msg });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (name, email, password, role = 'user', company_name?: string, domain?: string) => {
        set({ isLoading: true, error: null });
        try {
          const res = await apiClient.post<{ access_token: string; refresh_token: string }>(
            '/auth/register',
            { name, email, password, role }
          );
          const payload = JSON.parse(atob(res.access_token.split('.')[1]));
          const user: AuthUser = { id: payload.sub, name, email: payload.email, role: payload.role };
          get().setAuth(user, res.access_token, res.refresh_token);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error al registrarse';
          set({ error: msg });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      refreshAccess: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return;
        try {
          const res = await apiClient.post<{ access_token: string; refresh_token: string }>(
            '/auth/refresh',
            { refresh_token: refreshToken }
          );
          const payload = JSON.parse(atob(res.access_token.split('.')[1]));
          const user: AuthUser = { id: payload.sub, name: get().user?.name || '', email: payload.email, role: payload.role };
          get().setAuth(user, res.access_token, res.refresh_token);
        } catch {
          get().clearAuth();
        }
      },
    }),
    {
      name: COOKIE_NAME,
      storage: createJSONStorage(() => cookieStorage),
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) apiClient.setToken(state.token);
      },
    }
  )
);