'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
 * Injeta id nos headings h2/h3 DIRETAMENTE na string HTML e monta o sumário.
 * É feito com string pura (sem DOM) para funcionar no SSR e — o ponto crucial —
 * para os ids fazerem parte do HTML renderizado, sobrevivendo a re-renders.
 * (Setar id imperativamente após o render não funciona: o React reescreve o
 * innerHTML a partir da string e apaga os ids.)
 */
function addHeadingIds(html: string): { html: string; toc: TocItem[] } {
  const used = new Set<string>();
  const toc: TocItem[] = [];
  const withIds = html.replace(/<(h[23])>([\s\S]*?)<\/\1>/g, (match, tag: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    if (!text) return match;
    const base = slugify(text) || 'secao';
    let id = base;
    let n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    toc.push({ id, text, level: tag === 'h3' ? 3 : 2 });
    return `<${tag} id="${id}">${inner}</${tag}>`;
  });
  return { html: withIds, toc };
}

/**
 * Renderiza o HTML do post (JÁ SANITIZADO pela API com allow-list) e aplica
 * syntax highlight nos blocos de código + barra de progresso + sumário (TOC).
 */
export function PostContent({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const { html: htmlWithIds, toc } = useMemo(() => addHeadingIds(html), [html]);

  useEffect(() => {
    ref.current?.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block as HTMLElement);
    });
  }, [htmlWithIds]);

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
      <div ref={ref} className="post-prose" dangerouslySetInnerHTML={{ __html: htmlWithIds }} />
    </>
  );
}
