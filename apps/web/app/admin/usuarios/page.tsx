'use client';

import { useEffect, useState } from 'react';
import type { Paginated, Role } from '@blog/shared';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';
import { Avatar, Button, Input, Spinner } from '@/components/ui';

interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: Role;
  createdAt: string;
  postsCount: number;
  commentsCount: number;
}

const ROLES: { value: Role; label: string }[] = [
  { value: 'USER', label: 'Usuário' },
  { value: 'REDATOR', label: 'Redator' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [data, setData] = useState<Paginated<AdminUser> | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = (p: number, query: string) =>
    api
      .get<Paginated<AdminUser>>(`/users?page=${p}&pageSize=15${query ? `&q=${encodeURIComponent(query)}` : ''}`)
      .then((d) => {
        setData(d);
        setPage(p);
      });

  useEffect(() => {
    const t = setTimeout(() => void load(1, q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const changeRole = async (target: AdminUser, role: Role) => {
    setError(null);
    try {
      await api.patch(`/users/${target.id}/role`, { role });
      void load(page, q);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Erro ao alterar papel.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Usuários</h1>
        <Input
          placeholder="Buscar por nome ou username…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {data === null ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          {data.items.map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4 last:border-0 dark:border-stone-800"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar src={u.avatarUrl} name={u.displayName} size={36} />
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {u.displayName}{' '}
                    <span className="text-xs font-normal text-stone-400">@{u.username}</span>
                  </p>
                  <p className="text-xs text-stone-400">
                    desde {formatDate(u.createdAt)} · {u.postsCount} posts · {u.commentsCount}{' '}
                    comentários
                  </p>
                </div>
              </div>
              {u.id === me?.id ? (
                <span className="text-xs text-stone-400">você</span>
              ) : (
                <select
                  value={u.role}
                  onChange={(e) => void changeRole(u, e.target.value as Role)}
                  className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      )}

      {data && data.total > 15 && (
        <div className="flex justify-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => void load(page - 1, q)}>
            ← Anterior
          </Button>
          <Button variant="secondary" size="sm" disabled={!data.hasMore} onClick={() => void load(page + 1, q)}>
            Próxima →
          </Button>
        </div>
      )}
    </div>
  );
}
