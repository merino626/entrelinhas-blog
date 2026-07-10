import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PostDetail } from '@blog/shared';
import { apiGet } from '@/lib/api-server';
import { formatDate } from '@/lib/format';
import { Avatar } from '@/components/ui';
import { PostContent } from '@/components/post-content';
import { PostActions } from '@/components/post-actions';
import { FollowButton } from '@/components/follow-button';
import { CommentSection } from '@/components/comment-section';

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await apiGet<PostDetail>(`/posts/slug/${slug}`);
  if (!post) return { title: 'Post não encontrado' };
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: 'article',
      publishedTime: post.publishedAt ?? undefined,
      authors: [post.author.displayName],
      images: post.coverImageUrl ? [{ url: post.coverImageUrl }] : undefined,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await apiGet<PostDetail>(`/posts/slug/${slug}`);
  if (!post) notFound();

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
          <div className="flex items-center gap-3">
            <FollowButton
              kind="authors"
              targetId={post.author.id}
              checkPath={`/users/${post.author.username}`}
            />
            <PostActions post={post} />
          </div>
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

      <CommentSection postId={post.id} />
    </article>
  );
}
