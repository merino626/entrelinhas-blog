'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PostEditable } from '@blog/shared';
import { api } from '@/lib/api';
import { PostView } from '@/components/post-view';
import { Spinner } from '@/components/ui';

export default function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [post, setPost] = useState<PostEditable | null>(null);

  useEffect(() => {
    void api
      .get<PostEditable>(`/posts/${id}/edit`)
      .then(setPost)
      .catch(() => router.replace('/admin'));
  }, [id, router]);

  if (!post) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300">
        Pré-visualização{post.status === 'DRAFT' ? ' — rascunho não publicado' : ''}. Só você vê
        esta página.
      </div>
      <PostView post={post} />
    </div>
  );
}
