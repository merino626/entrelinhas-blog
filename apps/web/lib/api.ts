import { getToken, isTokenFresh, setToken } from './token-store';
import type { PublicProfile } from '@blog/shared';

export const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1`;

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message: string | string[] }).message;
    return Array.isArray(m) ? m[0] : m;
  }
  return fallback;
}

// ── Refresh de sessão (deduplicado) ──────────────────────────────────────────

export interface SessionPayload {
  accessToken: string;
  expiresAt: number;
  user: PublicProfile;
}

let refreshPromise: Promise<SessionPayload | null> | null = null;

export function refreshSession(): Promise<SessionPayload | null> {
  refreshPromise ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        setToken(null);
        return null;
      }
      const data = (await res.json()) as SessionPayload;
      setToken(data.accessToken, data.expiresAt);
      return data;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// ── Cliente ──────────────────────────────────────────────────────────────────

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** FormData para uploads (não define Content-Type). */
  formData?: FormData;
  /** Inclui cookies (rotas de auth). */
  credentials?: boolean;
  /** Não tenta refresh ao receber 401. */
  skipRefresh?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  // Renova o token proativamente se está vencendo e existe sessão
  if (!isTokenFresh() && getToken() !== null && !opts.skipRefresh) {
    await refreshSession();
  }

  const doFetch = () => {
    const token = getToken();
    return fetch(`${API_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.formData ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      credentials: opts.credentials ? 'include' : 'same-origin',
    });
  };

  let res = await doFetch();

  // 401 → tenta restaurar a sessão pelo cookie e repete uma vez
  if (res.status === 401 && !opts.skipRefresh) {
    const session = await refreshSession();
    if (session) res = await doFetch();
  }

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* sem corpo */
    }
    throw new ApiRequestError(res.status, messageFrom(body, `Erro ${res.status}`));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
  upload: <T>(path: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<T>(path, { method: 'POST', formData });
  },
  auth: {
    login: (body: { email: string; password: string }) =>
      request<SessionPayload>('/auth/login', {
        method: 'POST',
        body,
        credentials: true,
        skipRefresh: true,
      }),
    register: (body: {
      email: string;
      password: string;
      username: string;
      displayName: string;
    }) =>
      request<SessionPayload | { needsEmailConfirmation: true }>('/auth/register', {
        method: 'POST',
        body,
        credentials: true,
        skipRefresh: true,
      }),
    logout: () =>
      request<void>('/auth/logout', { method: 'POST', credentials: true, skipRefresh: true }),
    logoutAll: () => request<void>('/auth/logout-all', { method: 'POST', credentials: true }),
  },
};
