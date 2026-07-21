'use client';

import { useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { Button, Input, Spinner } from './ui';

const CONFIRM_WORD = 'EXCLUIR';

export function DeleteAccountModal({
  onClose,
  onDeleted,
}: {
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = password.length > 0 && confirm.trim().toUpperCase() === CONFIRM_WORD;

  const remove = async () => {
    if (!canDelete) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete('/users/me', { password });
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Não foi possível excluir a conta.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl dark:border-stone-700 dark:bg-stone-900">
        <div className="border-b border-stone-100 px-5 py-4 dark:border-stone-800">
          <h2 className="font-display text-lg font-semibold text-red-600 dark:text-red-400">
            Excluir conta
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Esta ação é <strong>permanente</strong>. Seus posts, comentários, curtidas e imagens
            serão apagados e não podem ser recuperados.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="del-pass" className="mb-1 block text-sm font-medium">
              Confirme sua senha
            </label>
            <Input
              id="del-pass"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="del-confirm" className="mb-1 block text-sm font-medium">
              Digite <span className="font-mono text-red-600 dark:text-red-400">{CONFIRM_WORD}</span>{' '}
              para confirmar
            </label>
            <Input
              id="del-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void remove()}
              disabled={!canDelete || busy}
            >
              {busy ? <Spinner /> : 'Excluir para sempre'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
