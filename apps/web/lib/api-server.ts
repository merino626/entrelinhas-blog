// Fetch server-side (RSC) para conteúdo público, com cache/ISR do Next.
import 'server-only';

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1`;

export async function apiGet<T>(path: string, revalidateSeconds = 60): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // API fora do ar não pode derrubar a página pública
    return null;
  }
}
