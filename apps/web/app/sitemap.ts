import type { MetadataRoute } from 'next';
import type { CategorySummary, Paginated, PostSummary } from '@blog/shared';

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1`;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
  ];

  try {
    const [postsRes, categoriesRes] = await Promise.all([
      fetch(`${API_URL}/posts?pageSize=50`, { next: { revalidate: 3600 } }),
      fetch(`${API_URL}/categories`, { next: { revalidate: 3600 } }),
    ]);
    if (postsRes.ok) {
      const posts = (await postsRes.json()) as Paginated<PostSummary>;
      for (const post of posts.items) {
        entries.push({
          url: `${SITE_URL}/blog/${post.slug}`,
          lastModified: post.publishedAt ?? undefined,
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }
    }
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
