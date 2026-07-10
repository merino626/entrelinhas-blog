'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PostDetail } from '@blog/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/** Curtir/salvar com UI otimista. Estado inicial vem re-consultado do cliente
 *  (a página é cacheada por ISR e não conhece o usuário). */
export function PostActions({ post }: { post: PostDetail }) {
  const { status } = useAuth();
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likes, setLikes] = useState(post.likesCount);

  useEffect(() => {
    if (status !== 'authenticated') return;
    void api
      .get<PostDetail>(`/posts/slug/${post.slug}`)
      .then((fresh) => {
        setLiked(fresh.likedByMe ?? false);
        setSaved(fresh.savedByMe ?? false);
        setLikes(fresh.likesCount);
      })
      .catch(() => undefined);
  }, [status, post.slug]);

  const requireAuth = () => {
    if (status !== 'authenticated') {
      router.push('/login');
      return false;
    }
    return true;
  };

  const toggleLike = async () => {
    if (!requireAuth()) return;
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    try {
      await (next ? api.post(`/posts/${post.id}/like`) : api.delete(`/posts/${post.id}/like`));
    } catch {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    }
  };

  const toggleSave = async () => {
    if (!requireAuth()) return;
    const next = !saved;
    setSaved(next);
    try {
      await (next ? api.post(`/posts/${post.id}/save`) : api.delete(`/posts/${post.id}/save`));
    } catch {
      setSaved(!next);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleLike}
        aria-pressed={liked}
        className={`group flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-all active:scale-95 ${
          liked
            ? 'border-accent bg-accent-soft text-accent dark:border-accent-dark dark:bg-accent/20 dark:text-accent-dark'
            : 'border-stone-300 text-stone-600 hover:border-accent hover:text-accent dark:border-stone-700 dark:text-stone-400 dark:hover:border-accent-dark dark:hover:text-accent-dark'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={liked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          className="transition-transform group-active:scale-125"
        >
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
        {likes}
      </button>

      <button
        onClick={toggleSave}
        aria-pressed={saved}
        title={saved ? 'Remover dos salvos' : 'Salvar para depois'}
        className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-all active:scale-95 ${
          saved
            ? 'border-accent bg-accent-soft text-accent dark:border-accent-dark dark:bg-accent/20 dark:text-accent-dark'
            : 'border-stone-300 text-stone-600 hover:border-accent hover:text-accent dark:border-stone-700 dark:text-stone-400 dark:hover:border-accent-dark dark:hover:text-accent-dark'
        }`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill={saved ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        >
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        </svg>
        {saved ? 'Salvo' : 'Salvar'}
      </button>

      <button
        onClick={() => {
          void navigator.clipboard.writeText(window.location.href);
        }}
        title="Copiar link"
        className="rounded-full border border-stone-300 px-3.5 py-1.5 text-sm text-stone-600 transition-all hover:border-accent hover:text-accent active:scale-95 dark:border-stone-700 dark:text-stone-400 dark:hover:border-accent-dark dark:hover:text-accent-dark"
      >
        Compartilhar
      </button>
    </div>
  );
}
