import type { Paginated, PostSummary } from '@blog/shared';

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1`;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const SITE_NAME = 'Entrelinhas';

// Revalida o feed a cada 10 min (também é invalidado sob demanda ao publicar).
export const revalidate = 600;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  let items: PostSummary[] = [];
  try {
    const res = await fetch(`${API_URL}/posts?pageSize=20`, { next: { revalidate } });
    if (res.ok) {
      const page = (await res.json()) as Paginated<PostSummary>;
      items = page.items;
    }
  } catch {
    // API fora do ar: feed vazio, mas válido.
  }

  const lastBuild = items[0]?.publishedAt ?? new Date().toISOString();

  const entries = items
    .map((post) => {
      const link = `${SITE_URL}/blog/${post.slug}`;
      const pubDate = post.publishedAt ? new Date(post.publishedAt).toUTCString() : '';
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      ${post.excerpt ? `<description>${escapeXml(post.excerpt)}</description>` : ''}
      ${post.category ? `<category>${escapeXml(post.category.name)}</category>` : ''}
      <dc:creator>${escapeXml(post.author.displayName)}</dc:creator>
      ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ''}
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>Artigos sobre tecnologia, tutoriais e carreira.</description>
    <language>pt-BR</language>
    <lastBuildDate>${new Date(lastBuild).toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(`${SITE_URL}/feed.xml`)}" rel="self" type="application/rss+xml" />
${entries}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 's-maxage=600, stale-while-revalidate',
    },
  });
}
