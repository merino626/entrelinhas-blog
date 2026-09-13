'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { Button, Input, Spinner } from '@/components/ui';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.auth.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Não foi possível enviar o e-mail.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-sm pt-10 text-center">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <p className="text-4xl">✉️</p>
          <h1 className="mt-4 font-display text-2xl font-semibold">Confira seu e-mail</h1>
          <p className="mt-2 text-sm text-stone-500">
            Se existir uma conta com o e-mail <strong>{email}</strong>, enviamos um link para
            redefinir a senha. Ele expira em algumas horas.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-accent hover:underline dark:text-accent-dark"
          >
            Voltar para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm pt-10">
      <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <h1 className="font-display text-2xl font-semibold">Recuperar senha</h1>
        <p className="mt-1 text-sm text-stone-500">
          Informe o e-mail da sua conta e enviaremos um link para redefinir a senha.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              E-mail
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Spinner /> : 'Enviar link'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          Lembrou a senha?{' '}
          <Link href="/login" className="font-medium text-accent hover:underline dark:text-accent-dark">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
