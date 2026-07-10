'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NotificationView, Paginated } from '@blog/shared';
import { api } from '@/lib/api';
import { getRealtimeClient } from '@/lib/realtime';
import { useAuth } from '@/lib/auth-context';
import { timeAgo } from '@/lib/format';
import { Spinner } from './ui';

function label(n: NotificationView): string {
  const first = n.actors[0]?.displayName ?? 'Alguém';
  const others = n.aggregatedCount - 1;
  const who =
    others <= 0
      ? first
      : others === 1 && n.actors[1]
        ? `${first} e ${n.actors[1].displayName}`
        : `${first} e mais ${others} ${others === 1 ? 'pessoa' : 'pessoas'}`;

  switch (n.type) {
    case 'POST_LIKE':
      return `${who} ${others > 0 ? 'curtiram' : 'curtiu'} seu post`;
    case 'COMMENT_REPLY':
      return n.entityType === 'POST'
        ? `${who} comentou no seu post`
        : `${who} respondeu seu comentário`;
    case 'COMMENT_REACTION':
      return `${who} ${others > 0 ? 'reagiram' : 'reagiu'} ao seu comentário`;
    case 'NEW_FOLLOWER':
      return `${who} começou a seguir você`;
    case 'FOLLOWED_AUTHOR_POST':
      return `${first} publicou: “${n.meta?.title ?? 'novo post'}”`;
  }
}

function linkOf(n: NotificationView): string {
  if (n.meta?.slug) return `/blog/${n.meta.slug}`;
  if (n.type === 'NEW_FOLLOWER' && n.actors[0]) return `/autor/${n.actors[0].username}`;
  return '/notificacoes';
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationView[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const fetchUnread = useCallback(async () => {
    try {
      const { count } = await api.get<{ count: number }>('/notifications/unread-count');
      setUnread(count);
    } catch {
      /* silencioso */
    }
  }, []);

  // Realtime (se anon key configurada) + polling de fallback
  useEffect(() => {
    if (!user) return;
    void fetchUnread();

    const client = getRealtimeClient();
    if (client) {
      const channel = client
        .channel('minhas-notificacoes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${user.id}`,
          },
          () => void fetchUnread(),
        )
        .subscribe();
      const interval = setInterval(fetchUnread, 120_000);
      return () => {
        void client.removeChannel(channel);
        clearInterval(interval);
      };
    }
    const interval = setInterval(fetchUnread, 45_000);
    return () => clearInterval(interval);
  }, [user, fetchUnread]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        const page = await api.get<Paginated<NotificationView>>('/notifications?pageSize=8');
        setItems(page.items);
      } catch {
        setItems([]);
      }
    }
  };

  const markAll = async () => {
    await api.post('/notifications/read-all');
    setUnread(0);
    setItems((prev) => prev?.map((n) => ({ ...n, isRead: true })) ?? null);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-ink dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-ink-dark"
        aria-label={`Notificações${unread > 0 ? ` (${unread} não lidas)` : ''}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white dark:bg-accent-dark dark:text-stone-950">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fade-in absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg dark:border-stone-700 dark:bg-stone-900">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5 dark:border-stone-800">
            <p className="text-sm font-semibold">Notificações</p>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="text-xs text-accent hover:underline dark:text-accent-dark"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items === null ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-stone-400">
                Nada por aqui ainda.
              </p>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={linkOf(n)}
                  onClick={() => {
                    setOpen(false);
                    if (!n.isRead) {
                      void api.post(`/notifications/${n.id}/read`).then(fetchUnread);
                    }
                  }}
                  className={`block border-b border-stone-50 px-4 py-3 text-sm transition-colors last:border-0 hover:bg-stone-50 dark:border-stone-800/50 dark:hover:bg-stone-800 ${
                    n.isRead ? 'opacity-60' : ''
                  }`}
                >
                  <p className="leading-snug">{label(n)}</p>
                  <p className="mt-0.5 text-xs text-stone-400">{timeAgo(n.lastEventAt)}</p>
                </Link>
              ))
            )}
          </div>
          <Link
            href="/notificacoes"
            onClick={() => setOpen(false)}
            className="block border-t border-stone-100 px-4 py-2.5 text-center text-xs font-medium text-accent hover:bg-stone-50 dark:border-stone-800 dark:text-accent-dark dark:hover:bg-stone-800"
          >
            Ver todas
          </Link>
        </div>
      )}
    </div>
  );
}
