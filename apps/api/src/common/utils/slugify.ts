import { randomBytes } from 'node:crypto';

/** Converte texto em slug URL-safe (remove acentos, minúsculas, hífens). */
export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s-]+/g, '-')
      .slice(0, 80)
      .replace(/^-+|-+$/g, '') || 'post'
  );
}

export function randomSuffix(): string {
  return randomBytes(3).toString('hex');
}
