'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui';

const NAV = [
  { href: '/admin', label: 'Posts', adminOnly: false },
  { href: '/admin/categorias', label: 'Categorias', adminOnly: true },
  { href: '/admin/usuarios', label: 'Usuários', adminOnly: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const allowed = user && (user.role === 'ADMIN' || user.role === 'REDATOR');

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
    else if (status === 'authenticated' && !allowed) router.replace('/');
  }, [status, allowed, router]);

  if (status === 'loading' || !allowed) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-[200px_1fr]">
      <aside>
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-widest text-stone-400">
          Painel
        </p>
        <nav className="flex gap-1 md:flex-col">
          {NAV.filter((item) => !item.adminOnly || user.role === 'ADMIN').map((item) => {
            const active =
              item.href === '/admin' ? pathname === '/admin' || pathname.startsWith('/admin/posts') : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent-soft text-accent dark:bg-accent/20 dark:text-accent-dark'
                    : 'text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
