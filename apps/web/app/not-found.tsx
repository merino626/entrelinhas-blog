import Link from 'next/link';
import { Button } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="font-display text-7xl font-semibold text-accent dark:text-accent-dark">404</p>
      <h1 className="font-display text-2xl font-semibold">Esta página se perdeu nas entrelinhas</h1>
      <p className="max-w-md text-stone-500">
        O conteúdo que você procura não existe ou foi movido.
      </p>
      <Link href="/">
        <Button variant="secondary">← Voltar ao início</Button>
      </Link>
    </div>
  );
}
