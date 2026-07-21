'use client';

import { useEffect, useState } from 'react';

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px' },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 3) return null;

  return (
    <nav
      aria-label="Sumário"
      className="fixed top-28 left-[calc(50%+400px)] hidden w-52 xl:block"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-400">
        Neste artigo
      </p>
      <ul className="space-y-1.5 border-l border-stone-200 dark:border-stone-800">
        {items.map((item) => (
          <li key={item.id} style={{ paddingLeft: item.level === 3 ? 16 : 0 }}>
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(item.id);
                if (!el) return;
                // Scroll manual com offset para o heading não ficar sob a navbar fixa.
                const y = el.getBoundingClientRect().top + window.scrollY - 88;
                window.scrollTo({ top: y, behavior: 'smooth' });
                history.replaceState(null, '', `#${item.id}`);
              }}
              className={`-ml-px block border-l-2 pl-3 text-sm leading-snug transition-colors ${
                active === item.id
                  ? 'border-accent text-accent dark:border-accent-dark dark:text-accent-dark'
                  : 'border-transparent text-stone-500 hover:text-ink dark:text-stone-400 dark:hover:text-ink-dark'
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
