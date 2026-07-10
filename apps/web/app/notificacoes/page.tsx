'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { NotificationView, Paginated } from '@blog/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { timeAgo } from '@/lib/format';
import { Button, EmptyState, Spinner } from '@/components/ui';

function describe(n: NotificationView): string {
  const first = n.actors[0]?.displayName ?? 'Alguém';
  const extra = n.aggregatedCount - 1;
  const who = extra > 0 ? `${first} e mais ${extra} ${extra === 1 ? 'pessoa' : 'pessoas'}` : first;
  switch (n.type) {
    case 'POST_LIKE':
      return `${who} ${extra > 0 ? 'curtiram' : 'curtiu'} seu post “${n.meta?.title ?? ''}”`;
    case 'COMMENT_REPLY':
      return n.entityType === 'POST'
        ? `${who} comentou no seu post “${n.meta?.title ?? ''}”`
        : `${who} respondeu seu comentário em “${n.meta?.title ?? ''}”`;
    case 'COMMENT_REACTION':
      return `${who} ${extra > 0 ? 'reagiram' : 'reagiu'} ao seu comentário em “${n.meta?.title ?? ''}”`;
    case 'NEW_FOLLOWER':
      return `${who} começou a seguir você`;
    case 'FOLLOWED_AUTHOR_POST':
      return `${first} publicou “${n.meta?.title ?? 'um novo post'}”`;
  }
}

function linkOf(n: NotificationView): string {
  if (n.meta?.slug) return `/blog/${n.meta.slug}`;
  if (n.type === 'NEW_FOLLOWER' && n.actors[0]) return `/autor/${n.actors[0].username}`;
  return '#';
}

export default function NotificationsPage() {
  const { status } = useAuth();
  const [data, setData] = useState<Paginated<NotificationView> | null>(null);
  const [items, setItems] = useState<NotificationView[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = async (p: number) => {
    setLoading(true);
    try {
      const result = await api.get<Paginated<NotificationView>>(
        `/notifications?page=${p}&pageSize=20`,
      );
      setData(result);
      setItems((prev) => (p === 1 ? result.items : [...prev, ...result.items]));
      setPage(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') void load(1);
  }, [status]);

  if (status === 'anonymous') {
    return (
      <EmptyState
        title="Entre para ver suas notificações"
        subtitle="Você precisa estar logado."
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Notificações</h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            await api.post('/notifications/read-all');
            setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
          }}
        >
          Marcar todas como lidas
        </Button>
      </div>

      {items.length === 0 && !loading ? (
        <EmptyState title="Nenhuma notificação" subtitle="Interações com você aparecem aqui." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          {items.map((n) => (
            <Link
              key={n.id}
              href={linkOf(n)}
              onClick={() => {
                if (!n.isRead) void api.post(`/notifications/${n.id}/read`);
              }}
              className={`flex items-start gap-3 border-b border-stone-100 px-5 py-4 transition-colors last:border-0 hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800 ${
                n.isRead ? 'opacity-60' : ''
              }`}
            >
              {!n.isRead && (
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent dark:bg-accent-dark" />
              )}
              <div className={n.isRead ? 'pl-5' : ''}>
                <p className="text-sm leading-snug">{describe(n)}</p>
                <p className="mt-1 text-xs text-stone-400">{timeAgo(n.lastEventAt)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {data?.hasMore && (
        <div className="text-center">
          <Button variant="secondary" onClick={() => void load(page + 1)} disabled={loading}>
            {loading ? <Spinner /> : 'Carregar mais'}
          </Button>
        </div>
      )}
    </div>
  );
}
