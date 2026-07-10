'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { PublicProfile } from '@blog/shared';
import { api, refreshSession, type SessionPayload } from './api';
import { setToken, getExpiresAt } from './token-store';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: PublicProfile | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    username: string;
    displayName: string;
  }) => Promise<{ needsEmailConfirmation: boolean }>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  updateUser: (user: PublicProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applySession = useCallback((session: SessionPayload | null) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!session) {
      setUser(null);
      setStatus('anonymous');
      return;
    }
    setUser(session.user);
    setStatus('authenticated');

    // Agenda a renovação ~1 min antes do access token expirar
    const ms = Math.max(30_000, (getExpiresAt() - 60) * 1000 - Date.now());
    timerRef.current = setTimeout(() => {
      void refreshSession().then(applySession);
    }, ms);
  }, []);

  // Restaura a sessão pelo cookie httpOnly ao carregar a página
  useEffect(() => {
    void refreshSession().then(applySession);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [applySession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await api.auth.login({ email, password });
      applySession(session);
    },
    [applySession],
  );

  const register = useCallback(
    async (data: { email: string; password: string; username: string; displayName: string }) => {
      const result = await api.auth.register(data);
      if ('needsEmailConfirmation' in result) {
        return { needsEmailConfirmation: true };
      }
      applySession(result);
      return { needsEmailConfirmation: false };
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setToken(null);
      applySession(null);
    }
  }, [applySession]);

  const logoutAll = useCallback(async () => {
    try {
      await api.auth.logoutAll();
    } finally {
      setToken(null);
      applySession(null);
    }
  }, [applySession]);

  const updateUser = useCallback((u: PublicProfile) => setUser(u), []);

  return (
    <AuthContext.Provider value={{ user, status, login, register, logout, logoutAll, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
