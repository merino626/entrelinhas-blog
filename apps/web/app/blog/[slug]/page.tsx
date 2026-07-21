import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Paginated, PostDetail, PostSummary } from '@blog/shared';
import { apiGet } from '@/lib/api-server';
import { PostView } from '@/components/post-view';
import { PostActions } from '@/components/post-actions';
import { FollowButton } from '@/components/follow-button';
import { CommentSection } from '@/components/comment-section';
import { RelatedPosts } from '@/components/related-posts';

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
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: 'article',
      url: `/blog/${slug}`,
      publishedTime: post.publishedAt ?? undefined,
      authors: [post.author.displayName],
    },
  };
}

async function fetchRelated(post: PostDetail): Promise<PostSummary[]> {
  const filter = post.category
    ? `category=${post.category.slug}`
    : `author=${post.author.username}`;
  const page = await apiGet<Paginated<PostSummary>>(`/posts?${filter}&pageSize=4`);
  return (page?.items ?? []).filter((p) => p.id !== post.id).slice(0, 3);
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await apiGet<PostDetail>(`/posts/slug/${slug}`);
  if (!post) notFound();

  const related = await fetchRelated(post);

  return (
    <>
      <PostView
        post={post}
        actions={
          <>
            <FollowButton
              kind="authors"
              targetId={post.author.id}
              checkPath={`/users/${post.author.username}`}
            />
            <PostActions post={post} />
          </>
        }
      />
      <div className="mx-auto max-w-3xl">
        <RelatedPosts posts={related} />
        <CommentSection postId={post.id} />
      </div>
    </>
  );
}
