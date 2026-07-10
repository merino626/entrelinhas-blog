'use client';

import { useEffect, useState } from 'react';
import type { CategorySummary } from '@blog/shared';
import { api, ApiRequestError } from '@/lib/api';
import { Button, EmptyState, Input, Spinner } from '@/components/ui';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategorySummary[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get<CategorySummary[]>('/categories').then(setCategories);

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post('/categories', { name: name.trim(), description: description.trim() || undefined });
      setName('');
      setDescription('');
      void load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Erro ao criar categoria.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: CategorySummary) => {
    if (!window.confirm(`Excluir a categoria “${c.name}”? Os posts dela ficam sem categoria.`))
      return;
    await api.delete(`/categories/${c.id}`);
    void load();
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Categorias</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
        <div className="min-w-40 flex-1">
          <label className="mb-1 block text-sm font-medium">Nome</label>
          <Input value={name} maxLength={48} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="min-w-60 flex-[2]">
          <label className="mb-1 block text-sm font-medium">Descrição (opcional)</label>
          <Input value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <Button onClick={() => void create()} disabled={saving || !name.trim()}>
          {saving ? <Spinner /> : 'Criar'}
        </Button>
        {error && <p className="w-full text-sm text-red-500">{error}</p>}
      </div>

      {categories === null ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : categories.length === 0 ? (
        <EmptyState title="Nenhuma categoria" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4 last:border-0 dark:border-stone-800"
            >
              <div>
                <p className="font-medium">
                  {c.name} <span className="text-xs text-stone-400">/{c.slug}</span>
                </p>
                <p className="text-xs text-stone-400">
                  {c.description ?? 'Sem descrição'} · {c.postsCount ?? 0} posts
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void remove(c)}>
                <span className="text-red-500">Excluir</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
