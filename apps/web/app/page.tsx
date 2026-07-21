import type { Metadata } from 'next';
import type { CategorySummary, Paginated, PostSummary } from '@blog/shared';
import { apiGet } from '@/lib/api-server';
import { PostCard } from '@/components/post-card';
import { EmptyState, Tag } from '@/components/ui';
import { FeedSection } from '@/components/feed-section';

export const metadata: Metadata = {
  title: 'Entrelinhas — um blog feito com carinho',
  alternates: { canonical: '/' },
};

export const revalidate = 60;

export default async function HomePage() {
  const [posts, categories] = await Promise.all([
    apiGet<Paginated<PostSummary>>('/posts?pageSize=13'),
    apiGet<CategorySummary[]>('/categories', 300),
  ]);

  const items = posts?.items ?? [];
  const [featured, ...rest] = items;

  return (
    <div className="space-y-12">
      <section className="space-y-4 pt-4 text-center">
        <h1 className="mx-auto max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Histórias e ideias, escritas nas{' '}
          <span className="text-accent dark:text-accent-dark">entrelinhas</span>
        </h1>
        <p className="mx-auto max-w-xl text-stone-600 dark:text-stone-400">
          Tecnologia, tutoriais e carreira — com a atenção aos detalhes que todo bom texto merece.
        </p>
        {categories && categories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {categories.map((c) => (
              <Tag key={c.id} href={`/categoria/${c.slug}`}>
                {c.name}
              </Tag>
            ))}
          </div>
        )}
      </section>

      <FeedSection />

      <section className="space-y-6">
        <h2 className="font-display text-2xl font-semibold">Últimas publicações</h2>
        {items.length === 0 ? (
          <EmptyState
            title="Nenhum post publicado ainda"
            subtitle="Os primeiros textos estão a caminho — volte em breve."
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featured && <PostCard post={featured} featured />}
            {rest.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
