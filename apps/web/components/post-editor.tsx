'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CategorySummary, PostEditable } from '@blog/shared';
import { LIMITS } from '@blog/shared';
import { api, ApiRequestError } from '@/lib/api';
import { Button, Input, Spinner, Textarea } from './ui';
import { TiptapEditor, type EditorPayload } from './tiptap-editor';

export function PostEditor({ postId }: { postId?: string }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(postId === undefined);
  const [post, setPost] = useState<PostEditable | null>(null);
  const [categories, setCategories] = useState<CategorySummary[]>([]);

  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [content, setContent] = useState<EditorPayload | null>(null);

  const [saving, setSaving] = useState(false);
  const [autosaving, setAutosaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  // Pula o autosave na hidratação inicial (setStates do carregamento).
  const skipAutosave = useRef(true);

  useEffect(() => {
    void api.get<CategorySummary[]>('/categories').then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!postId) return;
    void api
      .get<PostEditable>(`/posts/${postId}/edit`)
      .then((p) => {
        setPost(p);
        setTitle(p.title);
        setExcerpt(p.excerpt ?? '');
        setCategoryId(p.category?.id ?? '');
        setCoverImageUrl(p.coverImageUrl);
        setContent({ json: p.contentJson as Record<string, unknown>, html: p.contentHtml });
        setLoaded(true);
      })
      .catch(() => router.replace('/admin'));
  }, [postId, router]);

  const payload = () => ({
    title,
    excerpt: excerpt || undefined,
    categoryId: categoryId || undefined,
    coverImageUrl: coverImageUrl ?? undefined,
    contentJson: content?.json ?? { type: 'doc', content: [] },
    contentHtml: content?.html ?? '<p></p>',
  });

  const save = async (): Promise<PostEditable | null> => {
    if (title.trim().length < LIMITS.postTitle.min) {
      setError(`O título precisa de pelo menos ${LIMITS.postTitle.min} caracteres.`);
      return null;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = post
        ? await api.patch<PostEditable>(`/posts/${post.id}`, payload())
        : await api.post<PostEditable>('/posts', payload());
      setPost(saved);
      setSavedAt(new Date());
      if (!postId) window.history.replaceState(null, '', `/admin/posts/${saved.id}`);
      return saved;
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Erro ao salvar.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  /**
   * Autosave silencioso, só para rascunhos: um PATCH em post publicado iria
   * ao ar na hora, então isso continua exigindo o botão "Publicar/Salvar".
   */
  const autosave = async () => {
    if (saving || autosaving) return;
    if (post && post.status !== 'DRAFT') return;
    if (title.trim().length < LIMITS.postTitle.min) return;
    setAutosaving(true);
    try {
      const saved = post
        ? await api.patch<PostEditable>(`/posts/${post.id}`, payload())
        : await api.post<PostEditable>('/posts', payload());
      const isNew = !post;
      setPost(saved);
      setSavedAt(new Date());
      if (isNew) window.history.replaceState(null, '', `/admin/posts/${saved.id}`);
    } catch {
      // Silencioso: um salvar manual reporta o erro se persistir.
    } finally {
      setAutosaving(false);
    }
  };

  useEffect(() => {
    if (skipAutosave.current) {
      skipAutosave.current = false;
      return;
    }
    if (post && post.status !== 'DRAFT') return;
    if (title.trim().length < LIMITS.postTitle.min) return;
    const timer = setTimeout(() => void autosave(), 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, excerpt, categoryId, coverImageUrl, content]);

  const publish = async () => {
    const saved = await save();
    if (!saved) return;
    setSaving(true);
    try {
      const published = await api.post<PostEditable>(`/posts/${saved.id}/publish`);
      setPost(published);
      router.push('/admin');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Erro ao publicar.');
    } finally {
      setSaving(false);
    }
  };

  const unpublish = async () => {
    if (!post) return;
    const updated = await api.post<PostEditable>(`/posts/${post.id}/unpublish`);
    setPost(updated);
  };

  const uploadCover = async (file: File) => {
    setError(null);
    try {
      const { url } = await api.upload<{ url: string }>('/media/upload', file);
      setCoverImageUrl(url);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Erro no upload da capa.');
    }
  };

  if (!loaded) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">
          {post ? 'Editar post' : 'Novo post'}
          {post?.status === 'PUBLISHED' && (
            <span className="ml-2 align-middle rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
              Publicado
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          {autosaving ? (
            <span className="text-xs text-stone-400">salvando…</span>
          ) : (
            savedAt && (
              <span className="text-xs text-stone-400">
                salvo às {savedAt.toLocaleTimeString('pt-BR')}
              </span>
            )
          )}
          {post && (
            <Button
              variant="ghost"
              onClick={() => window.open(`/admin/preview/${post.id}`, '_blank')}
              disabled={saving}
            >
              Visualizar
            </Button>
          )}
          <Button variant="secondary" onClick={() => void save()} disabled={saving}>
            {saving ? <Spinner /> : 'Salvar rascunho'}
          </Button>
          {post?.status === 'PUBLISHED' ? (
            <Button variant="ghost" onClick={() => void unpublish()} disabled={saving}>
              Despublicar
            </Button>
          ) : (
            <Button onClick={() => void publish()} disabled={saving}>
              Publicar
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

      <Input
        placeholder="Título do post"
        value={title}
        maxLength={LIMITS.postTitle.max}
        onChange={(e) => setTitle(e.target.value)}
        className="!text-2xl !font-semibold !py-3 font-display"
      />

      <Textarea
        placeholder="Resumo (aparece nos cards e no Google — opcional)"
        rows={2}
        maxLength={LIMITS.postExcerpt.max}
        value={excerpt}
        onChange={(e) => setExcerpt(e.target.value)}
      />

      <div className="flex flex-wrap items-center gap-4">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        >
          <option value="">Sem categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => coverRef.current?.click()}>
            {coverImageUrl ? 'Trocar capa' : 'Adicionar capa'}
          </Button>
          {coverImageUrl && (
            <>
              <Image
                src={coverImageUrl}
                alt="Capa"
                width={80}
                height={45}
                className="rounded-md object-cover"
              />
              <button
                onClick={() => setCoverImageUrl(null)}
                className="text-xs text-red-500 hover:underline"
              >
                remover
              </button>
            </>
          )}
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadCover(f);
            }}
          />
        </div>
      </div>

      <TiptapEditor
        initialContent={postId ? (post?.contentJson as Record<string, unknown>) : null}
        onChange={setContent}
      />
    </div>
  );
}
