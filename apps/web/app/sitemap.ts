import type { MetadataRoute } from 'next';
import type { CategorySummary, Paginated, PostSummary } from '@blog/shared';

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1`;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const PAGE_SIZE = 50;
const MAX_PAGES = 5; // teto de segurança: até 250 posts no sitemap

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/feed.xml`, changeFrequency: 'daily', priority: 0.3 },
  ];

  try {
    // Percorre as páginas de posts publicados, coletando também os autores.
    const authors = new Set<string>();
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetch(`${API_URL}/posts?pageSize=${PAGE_SIZE}&page=${page}`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) break;
      const posts = (await res.json()) as Paginated<PostSummary>;
      for (const post of posts.items) {
        entries.push({
          url: `${SITE_URL}/blog/${post.slug}`,
          lastModified: post.publishedAt ?? undefined,
          changeFrequency: 'weekly',
          priority: 0.8,
        });
        authors.add(post.author.username);
      }
      if (!posts.hasMore) break;
    }

    for (const username of authors) {
      entries.push({
        url: `${SITE_URL}/autor/${username}`,
        changeFrequency: 'weekly',
        priority: 0.5,
      });
    }

    const categoriesRes = await fetch(`${API_URL}/categories`, {
      next: { revalidate: 3600 },
    });
    if (categoriesRes.ok) {
      const categories = (await categoriesRes.json()) as CategorySummary[];
      for (const c of categories) {
        entries.push({
          url: `${SITE_URL}/categoria/${c.slug}`,
          changeFrequency: 'daily',
          priority: 0.6,
        });
      }
    }
  } catch {
    // API fora do ar: sitemap mínimo
  }
  return entries;
}
