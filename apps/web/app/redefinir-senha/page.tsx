'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LIMITS } from '@blog/shared';
import { api, ApiRequestError } from '@/lib/api';
import { Button, Input, Spinner } from '@/components/ui';

/** Lê o access_token do #fragment que o GoTrue anexa ao link do e-mail. */
function readRecoveryToken(): string | null {
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  if (params.get('type') !== 'recovery') return null;
  return params.get('access_token');
}

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setToken(readRecoveryToken());
    // Tira o token da barra de endereço/histórico assim que lido.
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const passwordIssue = (pw: string): string | null => {
    if (pw.length > 0 && pw.length < LIMITS.password.min)
      return `Mínimo de ${LIMITS.password.min} caracteres.`;
    if (pw.length >= LIMITS.password.min && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(pw))
      return 'Use letra minúscula, maiúscula e número.';
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await api.auth.resetPassword({ token, password });
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Não foi possível redefinir a senha.');
    } finally {
      setLoading(false);
    }
  };

  // Ainda lendo o #fragment (evita "flash" de erro no primeiro render/SSR).
  if (token === undefined) return null;

  if (!token) {
    return (
      <div className="mx-auto max-w-sm pt-10 text-center">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <h1 className="font-display text-2xl font-semibold">Link inválido ou expirado</h1>
          <p className="mt-2 text-sm text-stone-500">
            Peça um novo link de recuperação e abra o e-mail mais recente.
          </p>
          <Link
            href="/recuperar-senha"
            className="mt-6 inline-block text-sm font-medium text-accent hover:underline dark:text-accent-dark"
          >
            Pedir novo link
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm pt-10 text-center">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <p className="text-4xl">✅</p>
          <h1 className="mt-4 font-display text-2xl font-semibold">Senha redefinida</h1>
          <p className="mt-2 text-sm text-stone-500">Redirecionando para o login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm pt-10">
      <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <h1 className="font-display text-2xl font-semibold">Nova senha</h1>
        <p className="mt-1 text-sm text-stone-500">Escolha uma nova senha para sua conta.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Nova senha
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={LIMITS.password.min}
              maxLength={LIMITS.password.max}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p
              className={`mt-1 text-xs ${passwordIssue(password) ? 'text-amber-600' : 'text-stone-400'}`}
            >
              {passwordIssue(password) ??
                `Mínimo ${LIMITS.password.min} caracteres, com maiúscula, minúscula e número.`}
            </p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button
            type="submit"
            disabled={loading || passwordIssue(password) !== null}
            className="w-full"
          >
            {loading ? <Spinner /> : 'Redefinir senha'}
          </Button>
        </form>
      </div>
    </div>
  );
}
