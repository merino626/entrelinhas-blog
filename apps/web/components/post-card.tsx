import Image from 'next/image';
import Link from 'next/link';
import type { PostSummary } from '@blog/shared';
import { Avatar } from './ui';
import { formatDate } from '@/lib/format';

export function PostCard({ post, featured = false }: { post: PostSummary; featured?: boolean }) {
  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-stone-800 dark:bg-stone-900 ${
        featured ? 'md:col-span-2 md:flex-row' : ''
      }`}
    >
      {post.coverImageUrl && (
        <div
          className={`relative overflow-hidden ${featured ? 'aspect-video md:aspect-auto md:w-1/2' : 'aspect-[16/9]'}`}
        >
          <Image
            src={post.coverImageUrl}
            alt=""
            fill
            sizes={featured ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 768px) 33vw, 100vw'}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
          {post.category && (
            <>
              <span className="font-medium text-accent dark:text-accent-dark">
                {post.category.name}
              </span>
              <span aria-hidden>·</span>
            </>
          )}
          <time dateTime={post.publishedAt ?? undefined}>{formatDate(post.publishedAt)}</time>
          <span aria-hidden>·</span>
          <span>{post.readingTimeMin} min de leitura</span>
        </div>

        <h2
          className={`font-display font-semibold leading-snug tracking-tight ${featured ? 'text-2xl md:text-3xl' : 'text-xl'}`}
        >
          <Link href={`/blog/${post.slug}`} className="focus-visible:outline-accent">
            {/* Link cobre o card inteiro */}
            <span className="absolute inset-0" aria-hidden />
            {post.title}
          </Link>
        </h2>

        {post.excerpt && (
          <p className="line-clamp-3 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
            {post.excerpt}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Avatar src={post.author.avatarUrl} name={post.author.displayName} size={26} />
            <span className="text-sm text-stone-600 dark:text-stone-400">
              {post.author.displayName}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-stone-400">
            <span title="Curtidas">♥ {post.likesCount}</span>
            <span title="Comentários">💬 {post.commentsCount}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
