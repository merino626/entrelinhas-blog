'use client';

import { useEffect, useRef, useState } from 'react';
import hljs from 'highlight.js/lib/common';
import { TableOfContents, type TocItem } from './table-of-contents';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

/**
 * Renderiza o HTML do post (JÁ SANITIZADO pela API com allow-list) e aplica
 * syntax highlight nos blocos de código + barra de progresso + sumário (TOC).
 * Os ids de heading são gerados no cliente (o sanitizador não os preserva).
 */
export function PostContent({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [toc, setToc] = useState<TocItem[]>([]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block as HTMLElement);
    });

    // Gera ids únicos nos headings e monta o sumário.
    const used = new Set<string>();
    const items: TocItem[] = [];
    el.querySelectorAll('h2, h3').forEach((node) => {
      const heading = node as HTMLElement;
      const text = heading.textContent?.trim() ?? '';
      if (!text) return;
      let id = slugify(text) || 'secao';
      let n = 2;
      while (used.has(id)) id = `${slugify(text)}-${n++}`;
      used.add(id);
      heading.id = id;
      items.push({ id, text, level: heading.tagName === 'H3' ? 3 : 2 });
    });
    setToc(items);
  }, [html]);

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const start = el.offsetTop - 80;
      const end = start + el.scrollHeight - window.innerHeight * 0.6;
      const p = ((window.scrollY - start) / Math.max(1, end - start)) * 100;
      setProgress(Math.min(100, Math.max(0, p)));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-50 h-0.5 bg-accent transition-[width] duration-150 dark:bg-accent-dark"
        style={{ width: `${progress}%` }}
        aria-hidden
      />
      <TableOfContents items={toc} />
      {/* Conteúdo sanitizado no servidor (sanitize-html allow-list) */}
      <div ref={ref} className="post-prose" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
