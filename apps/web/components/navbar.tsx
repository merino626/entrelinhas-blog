'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Avatar, Button } from './ui';
import { NotificationsBell } from './notifications-bell';

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };
  return (
    <button
      onClick={toggle}
      className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-ink dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-ink-dark"
      aria-label={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={dark ? 'Tema claro' : 'Tema escuro'}
    >
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!user) return null;
  const canWrite = user.role === 'ADMIN' || user.role === 'REDATOR';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-80"
        aria-label="Menu do usuário"
      >
        <Avatar src={user.avatarUrl} name={user.displayName} size={34} />
      </button>
      {open && (
        <div className="fade-in absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg dark:border-stone-700 dark:bg-stone-900">
          <div className="border-b border-stone-100 px-4 py-3 dark:border-stone-800">
            <p className="truncate text-sm font-medium">{user.displayName}</p>
            <p className="truncate text-xs text-stone-500">@{user.username}</p>
          </div>
          <nav className="py-1 text-sm">
            <MenuLink href={`/autor/${user.username}`} onClick={() => setOpen(false)}>
              Meu perfil público
            </MenuLink>
            <MenuLink href="/perfil" onClick={() => setOpen(false)}>
              Configurações
            </MenuLink>
            {canWrite && (
              <MenuLink href="/admin" onClick={() => setOpen(false)}>
                Painel de conteúdo
              </MenuLink>
            )}
            <button
              onClick={async () => {
                setOpen(false);
                await logout();
                router.push('/');
              }}
              className="block w-full px-4 py-2 text-left text-red-600 hover:bg-stone-50 dark:text-red-400 dark:hover:bg-stone-800"
            >
              Sair
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-4 py-2 hover:bg-stone-50 dark:hover:bg-stone-800"
    >
      {children}
    </Link>
  );
}

export function Navbar() {
  const { user, status } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-paper/80 backdrop-blur-md dark:border-stone-800/70 dark:bg-paper-dark/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="font-display text-2xl font-semibold tracking-tight">
          Entre<span className="text-accent dark:text-accent-dark">linhas</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-stone-600 dark:text-stone-300 sm:flex">
          <Link href="/" className="hover:text-accent dark:hover:text-accent-dark">
            Início
          </Link>
          {user && (
            <Link href="/?feed=1" className="hover:text-accent dark:hover:text-accent-dark">
              Para você
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {status === 'authenticated' && <NotificationsBell />}
          {status === 'authenticated' ? (
            <UserMenu />
          ) : status === 'anonymous' ? (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Entrar
                </Button>
              </Link>
              <Link href="/registro">
                <Button size="sm">Criar conta</Button>
              </Link>
            </div>
          ) : (
            <div className="h-8 w-24 animate-pulse rounded-lg bg-stone-200 dark:bg-stone-800" />
          )}
        </div>
      </div>
    </header>
  );
}
