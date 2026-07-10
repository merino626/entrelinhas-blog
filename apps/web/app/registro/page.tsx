'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LIMITS } from '@blog/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiRequestError } from '@/lib/api';
import { Button, Input, Spinner } from '@/components/ui';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', username: '', displayName: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const passwordIssue = (pw: string): string | null => {
    if (pw.length > 0 && pw.length < LIMITS.password.min)
      return `Mínimo de ${LIMITS.password.min} caracteres.`;
    if (pw.length >= LIMITS.password.min && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(pw))
      return 'Use letra minúscula, maiúscula e número.';
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await register({ ...form, username: form.username.toLowerCase() });
      if (result.needsEmailConfirmation) {
        setConfirmEmail(true);
      } else {
        router.push('/');
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  };

  if (confirmEmail) {
    return (
      <div className="mx-auto max-w-sm pt-10 text-center">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <p className="text-4xl">✉️</p>
          <h1 className="mt-4 font-display text-2xl font-semibold">Confirme seu e-mail</h1>
          <p className="mt-2 text-sm text-stone-500">
            Enviamos um link de confirmação para <strong>{form.email}</strong>. Depois de
            confirmar, é só{' '}
            <Link href="/login" className="text-accent hover:underline dark:text-accent-dark">
              entrar
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm pt-10">
      <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <h1 className="font-display text-2xl font-semibold">Criar conta</h1>
        <p className="mt-1 text-sm text-stone-500">
          Comente, curta, salve e siga seus autores favoritos.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="displayName" className="mb-1 block text-sm font-medium">
              Nome de exibição
            </label>
            <Input
              id="displayName"
              required
              minLength={LIMITS.displayName.min}
              maxLength={LIMITS.displayName.max}
              value={form.displayName}
              onChange={set('displayName')}
            />
          </div>
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium">
              Username
            </label>
            <Input
              id="username"
              required
              minLength={LIMITS.username.min}
              maxLength={LIMITS.username.max}
              pattern="[a-z0-9_]+"
              title="Apenas letras minúsculas, números e _"
              placeholder="ex.: maria_dev"
              value={form.username}
              onChange={set('username')}
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              E-mail
            </label>
            <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Senha
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={LIMITS.password.min}
              maxLength={LIMITS.password.max}
              value={form.password}
              onChange={set('password')}
            />
            <p className={`mt-1 text-xs ${passwordIssue(form.password) ? 'text-amber-600' : 'text-stone-400'}`}>
              {passwordIssue(form.password) ??
                `Mínimo ${LIMITS.password.min} caracteres, com maiúscula, minúscula e número.`}
            </p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" disabled={loading || passwordIssue(form.password) !== null} className="w-full">
            {loading ? <Spinner /> : 'Criar conta'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          Já tem conta?{' '}
          <Link href="/login" className="font-medium text-accent hover:underline dark:text-accent-dark">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
