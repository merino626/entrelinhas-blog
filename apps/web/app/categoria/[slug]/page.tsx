import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { CategorySummary, Paginated, PostSummary } from '@blog/shared';
import { apiGet } from '@/lib/api-server';
import { PostCard } from '@/components/post-card';
import { EmptyState } from '@/components/ui';
import { FollowButton } from '@/components/follow-button';

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await apiGet<CategorySummary>(`/categories/${slug}`, 300);
  if (!category) return { title: 'Categoria' };
  const description =
    category.description ?? `Posts na categoria ${category.name} no Entrelinhas.`;
  return {
    title: `Categoria: ${category.name}`,
    description,
    alternates: { canonical: `/categoria/${slug}` },
    openGraph: {
      title: `Categoria: ${category.name}`,
      description,
      url: `/categoria/${slug}`,
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const [category, posts] = await Promise.all([
    apiGet<CategorySummary & { followersCount: number }>(`/categories/${slug}`, 300),
    apiGet<Paginated<PostSummary>>(`/posts?category=${slug}&pageSize=18`),
  ]);
  if (!category) notFound();

  return (
    <div className="space-y-10">
      <header className="space-y-3 border-b border-stone-200 pb-8 dark:border-stone-800">
        <p className="text-sm font-medium uppercase tracking-widest text-accent dark:text-accent-dark">
          Categoria
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-4xl font-semibold tracking-tight">{category.name}</h1>
          <FollowButton
            kind="categories"
            targetId={category.id}
            checkPath={`/categories/${category.slug}`}
          />
        </div>
        {category.description && (
          <p className="max-w-2xl text-stone-600 dark:text-stone-400">{category.description}</p>
        )}
        <p className="text-sm text-stone-400">
          {category.postsCount ?? 0} {(category.postsCount ?? 0) === 1 ? 'post' : 'posts'} ·{' '}
          {category.followersCount ?? 0} seguindo
        </p>
      </header>

      {!posts || posts.items.length === 0 ? (
        <EmptyState title="Ainda não há posts nesta categoria" />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.items.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
