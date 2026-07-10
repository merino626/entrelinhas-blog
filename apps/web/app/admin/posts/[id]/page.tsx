import { PostEditor } from '@/components/post-editor';

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostEditor postId={id} />;
}
