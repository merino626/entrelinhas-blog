'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommentView, Paginated, ReactionType } from '@blog/shared';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { timeAgo } from '@/lib/format';
import { Avatar, Button, EmptyState, Spinner, Textarea } from './ui';

const PAGE_SIZE = 20;

function ReactionButtons({
  comment,
  onChange,
}: {
  comment: CommentView;
  onChange: (updated: CommentView) => void;
}) {
  const { status } = useAuth();

  const react = async (type: ReactionType) => {
    if (status !== 'authenticated') return;
    const removing = comment.myReaction === type;
    const prev = comment;
    const next: CommentView = {
      ...comment,
      myReaction: removing ? null : type,
      likesCount:
        comment.likesCount +
        (type === 'LIKE' ? (removing ? -1 : 1) : comment.myReaction === 'LIKE' ? -1 : 0),
      dislikesCount:
        comment.dislikesCount +
        (type === 'DISLIKE' ? (removing ? -1 : 1) : comment.myReaction === 'DISLIKE' ? -1 : 0),
    };
    onChange(next);
    try {
      await (removing
        ? api.delete(`/comments/${comment.id}/reaction`)
        : api.put(`/comments/${comment.id}/reaction`, { type }));
    } catch {
      onChange(prev);
    }
  };

  const btn = (type: ReactionType, count: number, label: string, path: string) => (
    <button
      onClick={() => react(type)}
      disabled={status !== 'authenticated'}
      aria-label={label}
      className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors disabled:cursor-default ${
        comment.myReaction === type
          ? 'text-accent dark:text-accent-dark'
          : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill={comment.myReaction === type ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
      {count > 0 && count}
    </button>
  );

  return (
    <div className="flex items-center gap-1">
      {btn('LIKE', comment.likesCount, 'Curtir comentário', 'M7 10v12 M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z')}
      {btn('DISLIKE', comment.dislikesCount, 'Não curtir comentário', 'M17 14V2 M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z')}
    </div>
  );
}

export function CommentSection({ postId }: { postId: string }) {
  const { user, status } = useAuth();
  const [comments, setComments] = useState<CommentView[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<CommentView | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const data = await api.get<Paginated<CommentView>>(
          `/posts/${postId}/comments?page=${p}&pageSize=${PAGE_SIZE}`,
        );
        setComments((prev) => (p === 1 ? data.items : [...prev, ...data.items]));
        setTotal(data.total);
        setPage(p);
      } finally {
        setLoading(false);
      }
    },
    [postId],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const submit = async () => {
    if (!content.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const created = await api.post<CommentView>(`/posts/${postId}/comments`, {
        content: content.trim(),
        parentCommentId: replyTo?.id,
      });
      setComments((prev) => [...prev, created]);
      setTotal((t) => t + 1);
      setContent('');
      setReplyTo(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Não foi possível comentar.');
    } finally {
      setSending(false);
    }
  };

  const startReply = (comment: CommentView) => {
    setReplyTo(comment);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const removeComment = async (id: string) => {
    await api.delete(`/comments/${id}`);
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, deleted: true, content: '', author: null } : c)),
    );
  };

  const updateComment = (updated: CommentView) => {
    setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <section className="mt-14 border-t border-stone-200 pt-10 dark:border-stone-800" id="comentarios">
      <h2 className="font-display text-2xl font-semibold">
        Comentários <span className="text-base font-normal text-stone-400">({total})</span>
      </h2>

      {/* Thread única, ordem cronológica */}
      <div className="mt-6 space-y-5">
        {loading && comments.length === 0 ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : comments.length === 0 ? (
          <EmptyState title="Seja a primeira pessoa a comentar" />
        ) : (
          comments.map((comment) => (
            <article key={comment.id} className="fade-in flex gap-3">
              <div className="shrink-0 pt-0.5">
                {comment.deleted || !comment.author ? (
                  <span className="inline-block size-8 rounded-full bg-stone-200 dark:bg-stone-800" />
                ) : (
                  <Avatar src={comment.author.avatarUrl} name={comment.author.displayName} size={32} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {comment.deleted ? (
                  <p className="py-1 text-sm italic text-stone-400">[comentário removido]</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <Link
                        href={`/autor/${comment.author!.username}`}
                        className="text-sm font-semibold hover:text-accent dark:hover:text-accent-dark"
                      >
                        {comment.author!.displayName}
                      </Link>
                      <span className="text-xs text-stone-400">{timeAgo(comment.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {comment.mentionedUser && (
                        <Link
                          href={`/autor/${comment.mentionedUser.username}`}
                          className="mr-1 font-medium text-accent hover:underline dark:text-accent-dark"
                        >
                          @{comment.mentionedUser.username}
                        </Link>
                      )}
                      {comment.content}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3">
                      <ReactionButtons comment={comment} onChange={updateComment} />
                      {status === 'authenticated' && (
                        <button
                          onClick={() => startReply(comment)}
                          className="text-xs text-stone-400 hover:text-accent dark:hover:text-accent-dark"
                        >
                          Responder
                        </button>
                      )}
                      {(isAdmin || user?.id === comment.author!.id) && (
                        <button
                          onClick={() => void removeComment(comment.id)}
                          className="text-xs text-stone-400 hover:text-red-500"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </article>
          ))
        )}

        {comments.length < total && (
          <div className="text-center">
            <Button variant="secondary" size="sm" onClick={() => void load(page + 1)} disabled={loading}>
              {loading ? <Spinner /> : 'Carregar mais comentários'}
            </Button>
          </div>
        )}
      </div>

      {/* Formulário */}
      <div ref={formRef} className="mt-8">
        {status === 'authenticated' ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
            {replyTo && !replyTo.deleted && replyTo.author && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-accent-soft/60 px-3 py-1.5 text-xs text-accent dark:bg-accent/15 dark:text-accent-dark">
                <span>
                  Respondendo a <strong>@{replyTo.author.username}</strong>
                </span>
                <button onClick={() => setReplyTo(null)} className="font-bold" aria-label="Cancelar resposta">
                  ✕
                </button>
              </div>
            )}
            <Textarea
              rows={3}
              maxLength={2000}
              placeholder={replyTo ? 'Escreva sua resposta…' : 'Compartilhe o que achou…'}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-stone-400">{content.length}/2000</span>
              <Button onClick={() => void submit()} disabled={!content.trim() || sending}>
                {sending ? <Spinner /> : replyTo ? 'Responder' : 'Comentar'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-stone-300 py-6 text-center text-sm text-stone-500 dark:border-stone-700">
            <Link href="/login" className="font-medium text-accent hover:underline dark:text-accent-dark">
              Entre na sua conta
            </Link>{' '}
            para participar da conversa.
          </p>
        )}
      </div>
    </section>
  );
}
