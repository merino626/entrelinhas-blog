import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Paginated, PostSummary, PublicProfile } from '@blog/shared';
import { apiGet } from '@/lib/api-server';
import { PostCard } from '@/components/post-card';
import { Avatar, EmptyState } from '@/components/ui';
import { FollowButton } from '@/components/follow-button';
import { formatDate } from '@/lib/format';

export const revalidate = 60;

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await apiGet<PublicProfile>(`/users/${username}`);
  if (!profile) return { title: 'Autor' };
  const description =
    profile.bio ?? `Publicações de ${profile.displayName} (@${profile.username}) no Entrelinhas.`;
  return {
    title: `${profile.displayName} (@${profile.username})`,
    description,
    alternates: { canonical: `/autor/${username}` },
    openGraph: {
      type: 'profile',
      title: profile.displayName,
      description,
      url: `/autor/${username}`,
      images: profile.avatarUrl ? [{ url: profile.avatarUrl }] : undefined,
    },
  };
}

export default async function AuthorPage({ params }: Props) {
  const { username } = await params;
  const [profile, posts] = await Promise.all([
    apiGet<PublicProfile>(`/users/${username}`),
    apiGet<Paginated<PostSummary>>(`/posts?author=${username}&pageSize=18`),
  ]);
  if (!profile) notFound();

  const roleLabel =
    profile.role === 'ADMIN' ? 'Administração' : profile.role === 'REDATOR' ? 'Redator' : null;

  return (
    <div className="space-y-10">
      <header className="flex flex-col items-center gap-5 border-b border-stone-200 pb-10 text-center dark:border-stone-800 sm:flex-row sm:items-start sm:text-left">
        <Avatar src={profile.avatarUrl} name={profile.displayName} size={96} />
        <div className="flex-1 space-y-2">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                {profile.displayName}
                {roleLabel && (
                  <span className="ml-2 align-middle rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent dark:bg-accent/20 dark:text-accent-dark">
                    {roleLabel}
                  </span>
                )}
              </h1>
              <p className="text-sm text-stone-500">@{profile.username}</p>
            </div>
            <FollowButton
              kind="authors"
              targetId={profile.id}
              checkPath={`/users/${profile.username}`}
            />
          </div>
          {profile.bio && <p className="max-w-xl text-stone-600 dark:text-stone-400">{profile.bio}</p>}
          <p className="text-sm text-stone-400">
            <strong className="text-ink dark:text-ink-dark">{profile.followersCount ?? 0}</strong>{' '}
            seguidores ·{' '}
            <strong className="text-ink dark:text-ink-dark">{profile.followingCount ?? 0}</strong>{' '}
            seguindo ·{' '}
            <strong className="text-ink dark:text-ink-dark">{profile.postsCount ?? 0}</strong> posts
            · desde {formatDate(profile.createdAt)}
          </p>
        </div>
      </header>

      <section className="space-y-6">
        <h2 className="font-display text-2xl font-semibold">Publicações</h2>
        {!posts || posts.items.length === 0 ? (
          <EmptyState title={`${profile.displayName} ainda não publicou nada`} />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
