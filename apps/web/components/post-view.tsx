import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PostDetail } from '@blog/shared';
import { formatDate } from '@/lib/format';
import { Avatar } from './ui';
import { PostContent } from './post-content';

/**
 * Renderização compartilhada de um post — usada tanto na página pública
 * (`/blog/[slug]`) quanto na pré-visualização de rascunho no admin.
 * O slot `actions` recebe follow/curtir/salvar na versão pública.
 */
export function PostView({ post, actions }: { post: PostDetail; actions?: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl">
      <header className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
          {post.category && (
            <>
              <Link
                href={`/categoria/${post.category.slug}`}
                className="font-medium text-accent hover:underline dark:text-accent-dark"
              >
                {post.category.name}
              </Link>
              <span aria-hidden>·</span>
            </>
          )}
          <time dateTime={post.publishedAt ?? undefined}>{formatDate(post.publishedAt)}</time>
          <span aria-hidden>·</span>
          <span>{post.readingTimeMin} min de leitura</span>
        </div>

        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="text-lg leading-relaxed text-stone-600 dark:text-stone-400">
            {post.excerpt}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-y border-stone-200 py-4 dark:border-stone-800">
          <Link href={`/autor/${post.author.username}`} className="group flex items-center gap-3">
            <Avatar src={post.author.avatarUrl} name={post.author.displayName} size={42} />
            <div>
              <p className="text-sm font-semibold group-hover:text-accent dark:group-hover:text-accent-dark">
                {post.author.displayName}
              </p>
              <p className="text-xs text-stone-500">@{post.author.username}</p>
            </div>
          </Link>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
      </header>

      {post.coverImageUrl && (
        <div className="relative mt-8 aspect-[16/8] overflow-hidden rounded-2xl shadow-md">
          <Image
            src={post.coverImageUrl}
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover"
          />
        </div>
      )}

      <div className="mt-10">
        <PostContent html={post.contentHtml} />
      </div>
    </article>
  );
}
