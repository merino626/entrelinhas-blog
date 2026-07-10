'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Paginated, PostSummary } from '@blog/shared';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Button, EmptyState, Spinner } from '@/components/ui';

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PUBLISHED: {
    text: 'Publicado',
    cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  },
  DRAFT: {
    text: 'Rascunho',
    cls: 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
  },
  ARCHIVED: {
    text: 'Arquivado',
    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  },
};

export default function AdminPostsPage() {
  const [data, setData] = useState<Paginated<PostSummary> | null>(null);
  const [page, setPage] = useState(1);

  const load = (p: number) =>
    api.get<Paginated<PostSummary>>(`/posts/mine?page=${p}&pageSize=15`).then((d) => {
      setData(d);
      setPage(p);
    });

  useEffect(() => {
    void load(1);
  }, []);

  const remove = async (id: string, title: string) => {
    if (!window.confirm(`Excluir definitivamente “${title}”?`)) return;
    await api.delete(`/posts/${id}`);
    void load(page);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Posts</h1>
        <Link href="/admin/posts/novo">
          <Button>+ Novo post</Button>
        </Link>
      </div>

      {data === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState title="Nenhum post ainda" subtitle="Clique em “Novo post” para começar." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          {data.items.map((post) => {
            const st = STATUS_LABEL[post.status] ?? STATUS_LABEL.DRAFT;
            return (
              <div
                key={post.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4 last:border-0 dark:border-stone-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                      {st.text}
                    </span>
                    <p className="truncate font-medium">{post.title}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-400">
                    por {post.author.displayName} ·{' '}
                    {post.publishedAt
                      ? `publicado em ${formatDate(post.publishedAt)}`
                      : `criado em ${formatDate(post.createdAt)}`}{' '}
                    · ♥ {post.likesCount} · 💬 {post.commentsCount} · {post.viewCount} views
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {post.status === 'PUBLISHED' && (
                    <Link
                      href={`/blog/${post.slug}`}
                      className="text-sm text-stone-500 hover:text-accent dark:hover:text-accent-dark"
                    >
                      Ver
                    </Link>
                  )}
                  <Link href={`/admin/posts/${post.id}`}>
                    <Button variant="secondary" size="sm">
                      Editar
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => void remove(post.id, post.title)}>
                    <span className="text-red-500">Excluir</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data && data.total > 15 && (
        <div className="flex justify-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => void load(page - 1)}>
            ← Anterior
          </Button>
          <Button variant="secondary" size="sm" disabled={!data.hasMore} onClick={() => void load(page + 1)}>
            Próxima →
          </Button>
        </div>
      )}
    </div>
  );
}
