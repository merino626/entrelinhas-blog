'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Paginated, PostSummary, PublicProfile, SessionView } from '@blog/shared';
import { LIMITS } from '@blog/shared';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, timeAgo } from '@/lib/format';
import { Avatar, Button, EmptyState, Input, Spinner, Textarea } from '@/components/ui';
import { PostCard } from '@/components/post-card';

type Tab = 'dados' | 'curtidos' | 'salvos' | 'seguranca';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dados', label: 'Meu perfil' },
  { id: 'curtidos', label: 'Curtidos' },
  { id: 'salvos', label: 'Salvos' },
  { id: 'seguranca', label: 'Segurança' },
];

function ProfileTab() {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setBio(user.bio ?? '');
    }
  }, [user]);

  if (!user) return null;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await api.patch<PublicProfile>('/users/me', { displayName, bio });
      updateUser(updated);
      setMessage('Perfil atualizado!');
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setMessage(null);
    try {
      const updated = await api.upload<PublicProfile>('/media/avatar', file);
      updateUser({ ...user, ...updated });
      setMessage('Avatar atualizado!');
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Erro no upload do avatar.');
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-5">
        <Avatar src={user.avatarUrl} name={user.displayName} size={72} />
        <div>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            Trocar foto
          </Button>
          <p className="mt-1 text-xs text-stone-400">JPG/PNG/WebP até 2 MB.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadAvatar(file);
            }}
          />
        </div>
      </div>

      <div>
        <label htmlFor="displayName" className="mb-1 block text-sm font-medium">
          Nome de exibição
        </label>
        <Input
          id="displayName"
          value={displayName}
          minLength={LIMITS.displayName.min}
          maxLength={LIMITS.displayName.max}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="bio" className="mb-1 block text-sm font-medium">
          Bio
        </label>
        <Textarea
          id="bio"
          rows={3}
          maxLength={LIMITS.bio.max}
          placeholder="Conte um pouco sobre você…"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
        <p className="mt-1 text-right text-xs text-stone-400">
          {bio.length}/{LIMITS.bio.max}
        </p>
      </div>

      {message && <p className="text-sm text-accent dark:text-accent-dark">{message}</p>}
      <Button onClick={() => void save()} disabled={saving}>
        {saving ? <Spinner /> : 'Salvar alterações'}
      </Button>
    </div>
  );
}

function PostListTab({ endpoint, emptyTitle }: { endpoint: string; emptyTitle: string }) {
  const [posts, setPosts] = useState<PostSummary[] | null>(null);

  useEffect(() => {
    void api
      .get<Paginated<PostSummary>>(`${endpoint}?pageSize=18`)
      .then((page) => setPosts(page.items))
      .catch(() => setPosts([]));
  }, [endpoint]);

  if (posts === null) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }
  if (posts.length === 0) {
    return <EmptyState title={emptyTitle} subtitle="Só você consegue ver esta lista." />;
  }
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}

function SecurityTab() {
  const { logoutAll } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionView[] | null>(null);

  const load = () =>
    api
      .get<SessionView[]>('/auth/sessions')
      .then(setSessions)
      .catch(() => setSessions([]));

  useEffect(() => {
    void load();
  }, []);

  const revoke = async (id: string) => {
    await api.delete(`/auth/sessions/${id}`);
    void load();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="font-semibold">Dispositivos conectados</h3>
        <p className="text-sm text-stone-500">
          Sessões ativas da sua conta. Revogue qualquer uma que não reconhecer.
        </p>
      </div>

      {sessions === null ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4 last:border-0 dark:border-stone-800"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {s.userAgent ?? 'Dispositivo desconhecido'}
                  {s.current && (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-400">
                      este dispositivo
                    </span>
                  )}
                </p>
                <p className="text-xs text-stone-400">
                  {s.ip ?? 'IP desconhecido'} · ativo {timeAgo(s.lastSeenAt)} · desde{' '}
                  {formatDate(s.createdAt)}
                </p>
              </div>
              {!s.current && (
                <Button variant="danger" size="sm" onClick={() => void revoke(s.id)}>
                  Revogar
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 dark:border-red-900/50 dark:bg-red-950/20">
        <h4 className="font-medium text-red-700 dark:text-red-400">Sair de todos os dispositivos</h4>
        <p className="mt-1 text-sm text-stone-500">
          Encerra todas as sessões, inclusive esta. Use se suspeitar de acesso indevido.
        </p>
        <Button
          variant="danger"
          size="sm"
          className="mt-3"
          onClick={async () => {
            await logoutAll();
            router.push('/login');
          }}
        >
          Encerrar todas as sessões
        </Button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, status } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('dados');

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated' || !user) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold">Minha conta</h1>
        <p className="text-sm text-stone-500">
          @{user.username} · membro desde {formatDate(user.createdAt)}
        </p>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-stone-200 dark:border-stone-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-accent text-accent dark:border-accent-dark dark:text-accent-dark'
                : 'border-transparent text-stone-500 hover:text-ink dark:hover:text-ink-dark'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="fade-in">
        {tab === 'dados' && <ProfileTab />}
        {tab === 'curtidos' && (
          <PostListTab endpoint="/posts/liked" emptyTitle="Você ainda não curtiu nenhum post" />
        )}
        {tab === 'salvos' && (
          <PostListTab endpoint="/posts/saved" emptyTitle="Você ainda não salvou nenhum post" />
        )}
        {tab === 'seguranca' && <SecurityTab />}
      </div>
    </div>
  );
}
