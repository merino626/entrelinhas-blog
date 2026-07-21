/**
 * Gera capas (webp) para posts publicados que ainda não têm coverImageUrl,
 * sobe no bucket post-media e atualiza o post.
 * Uso: pnpm --filter @blog/api run seed:covers
 *
 * As capas são SVG on-brand (gradiente por categoria + título + wordmark)
 * rasterizadas para webp 1200×630 via sharp. Idempotente: só toca em posts
 * sem capa; re-rodar sobrescreve o arquivo (upsert).
 */
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import * as fs from 'node:fs';
import * as path from 'node:path';

const envPath = path.join(__dirname, '..', '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = 'post-media';

const THEMES: Record<string, { from: string; to: string; accent: string }> = {
  tecnologia: { from: '#1e3a8a', to: '#0f172a', accent: '#60a5fa' },
  tutoriais: { from: '#0f766e', to: '#0c2926', accent: '#5eead4' },
  carreira: { from: '#b45309', to: '#3b1d06', accent: '#fbbf24' },
  default: { from: '#3730a3', to: '#111827', accent: '#a5b4fc' },
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function wrap(title: string, maxChars: number): string[] {
  const words = title.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

function buildSvg(title: string, categoryLabel: string, categorySlug: string): string {
  const t = THEMES[categorySlug] ?? THEMES.default;
  const lines = wrap(title, 24);
  const lineHeight = 74;
  const startY = 310 - ((lines.length - 1) * lineHeight) / 2;
  const titleTspans = lines
    .map((l, idx) => `<tspan x="80" y="${startY + idx * lineHeight}">${esc(l)}</tspan>`)
    .join('');

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.from}"/>
      <stop offset="1" stop-color="${t.to}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1050" cy="120" r="260" fill="${t.accent}" opacity="0.10"/>
  <circle cx="1120" cy="560" r="160" fill="${t.accent}" opacity="0.08"/>
  <rect x="80" y="80" width="54" height="6" rx="3" fill="${t.accent}"/>
  <text x="80" y="128" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700" letter-spacing="3" fill="${t.accent}">${esc(categoryLabel.toUpperCase())}</text>
  <text font-family="Georgia, 'Times New Roman', serif" font-size="60" font-weight="700" fill="#ffffff">${titleTspans}</text>
  <text x="80" y="560" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="700" fill="#ffffff" opacity="0.92">Entre<tspan fill="${t.accent}">linhas</tspan></text>
</svg>`;
}

const prisma = new PrismaClient();
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED', coverImageUrl: null },
    select: { id: true, slug: true, title: true, category: { select: { name: true, slug: true } } },
  });

  if (posts.length === 0) {
    console.log('Nenhum post sem capa. Nada a fazer.');
    await prisma.$disconnect();
    return;
  }

  let done = 0;
  for (const post of posts) {
    const catSlug = post.category?.slug ?? 'default';
    const catLabel = post.category?.name ?? 'Artigo';
    const svg = buildSvg(post.title, catLabel, catSlug);
    const webp = await sharp(Buffer.from(svg)).webp({ quality: 88 }).toBuffer();

    const filePath = `covers/${post.slug}.webp`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, webp, { contentType: 'image/webp', cacheControl: '31536000', upsert: true });
    if (upErr) {
      console.error(`✗ upload falhou (${post.slug}): ${upErr.message}`);
      continue;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    await prisma.post.update({ where: { id: post.id }, data: { coverImageUrl: data.publicUrl } });
    console.log(`✓ capa [${catSlug}] "${post.title}"`);
    done++;
  }

  console.log(`\nConcluído: ${done} capa(s) gerada(s).`);
  await prisma.$disconnect();
}

void main();
