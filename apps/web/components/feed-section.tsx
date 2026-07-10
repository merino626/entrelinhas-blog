'use client';

import { useEffect, useState } from 'react';
import type { Paginated, PostSummary } from '@blog/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PostCard } from './post-card';

/** Seção "Para você" — só aparece logado e com follows que gerem recomendação. */
export function FeedSection() {
  const { status } = useAuth();
  const [posts, setPosts] = useState<PostSummary[] | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') {
      setPosts(null);
      return;
    }
    void api
      .get<Paginated<PostSummary>>('/posts/feed?pageSize=6')
      .then((page) => setPosts(page.items))
      .catch(() => setPosts(null));
  }, [status]);

  if (!posts || posts.length === 0) return null;

  return (
    <section className="fade-in space-y-6">
      <div className="flex items-baseline gap-3">
        <h2 className="font-display text-2xl font-semibold">Para você</h2>
        <span className="text-sm text-stone-400">baseado em quem você segue</span>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
