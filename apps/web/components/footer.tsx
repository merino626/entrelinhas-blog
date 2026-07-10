import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-stone-200 py-10 dark:border-stone-800">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center text-sm text-stone-500 dark:text-stone-400 sm:flex-row sm:justify-between sm:text-left">
        <p>
          <span className="font-display text-base text-ink dark:text-ink-dark">Entrelinhas</span>
          {' — '}escrito com carinho, linha por linha.
        </p>
        <nav className="flex gap-5">
          <Link href="/" className="hover:text-accent dark:hover:text-accent-dark">
            Início
          </Link>
          <Link href="/registro" className="hover:text-accent dark:hover:text-accent-dark">
            Criar conta
          </Link>
        </nav>
      </div>
    </footer>
  );
}
