'use client';

import { useEffect, useRef, useState } from 'react';
import hljs from 'highlight.js/lib/common';

/**
 * Renderiza o HTML do post (JÁ SANITIZADO pela API com allow-list) e aplica
 * syntax highlight nos blocos de código + barra de progresso de leitura.
 */
export function PostContent({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    ref.current?.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block as HTMLElement);
    });
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
      {/* Conteúdo sanitizado no servidor (sanitize-html allow-list) */}
      <div ref={ref} className="post-prose" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
