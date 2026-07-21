import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

// Invalidação sob demanda do cache ISR, disparada pela API ao publicar/editar posts.
// Protegida por segredo compartilhado (header x-revalidate-secret).
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'revalidation disabled' }, { status: 503 });
  }
  if (request.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let paths: unknown;
  try {
    ({ paths } = await request.json());
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!Array.isArray(paths)) {
    return NextResponse.json({ error: 'paths must be an array' }, { status: 400 });
  }

  const valid = paths
    .filter((p): p is string => typeof p === 'string' && p.startsWith('/'))
    .slice(0, 20);
  for (const path of valid) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: valid });
}
