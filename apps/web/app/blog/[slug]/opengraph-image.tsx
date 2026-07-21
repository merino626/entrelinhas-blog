import { ImageResponse } from 'next/og';
import type { PostDetail } from '@blog/shared';

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1`;

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Entrelinhas';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function OgImage({ params }: Props) {
  const { slug } = await params;
  let post: PostDetail | null = null;
  try {
    const res = await fetch(`${API_URL}/posts/slug/${slug}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) post = (await res.json()) as PostDetail;
  } catch {
    // segue com o fallback genérico
  }

  const title = post?.title ?? 'Entrelinhas';
  const author = post?.author.displayName;
  const category = post?.category?.name;
  const cover = post?.coverImageUrl ?? undefined;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          backgroundColor: '#1c1917',
          backgroundImage: cover
            ? `linear-gradient(rgba(28,25,23,0.72), rgba(28,25,23,0.92)), url(${cover})`
            : 'linear-gradient(135deg, #292524, #1c1917)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: '#fafaf9',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
          <span>Entre</span>
          <span style={{ color: '#f59e0b' }}>linhas</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {category && (
            <div
              style={{
                display: 'flex',
                alignSelf: 'flex-start',
                backgroundColor: 'rgba(245,158,11,0.18)',
                color: '#fbbf24',
                fontSize: 26,
                fontWeight: 600,
                padding: '8px 20px',
                borderRadius: 999,
              }}
            >
              {category}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              fontSize: title.length > 70 ? 58 : 72,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -1.5,
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 30, color: '#d6d3d1' }}>
          {author ? `por ${author}` : 'Tecnologia, tutoriais e carreira'}
        </div>
      </div>
    ),
    size,
  );
}
