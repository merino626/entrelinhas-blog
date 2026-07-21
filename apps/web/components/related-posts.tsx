import type { PostSummary } from '@blog/shared';
import { PostCard } from './post-card';

export function RelatedPosts({ posts }: { posts: PostSummary[] }) {
  if (posts.length === 0) return null;
  return (
    <section className="mt-16 border-t border-stone-200 pt-10 dark:border-stone-800">
      <h2 className="mb-6 font-display text-2xl font-semibold">Leia também</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
