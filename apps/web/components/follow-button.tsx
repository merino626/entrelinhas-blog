'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from './ui';

export function FollowButton({
  kind,
  targetId,
  checkPath,
}: {
  kind: 'authors' | 'categories';
  targetId: string;
  /** Endpoint que devolve { isFollowedByMe } para estado inicial (ex.: /users/username). */
  checkPath: string;
}) {
  const { status, user } = useAuth();
  const router = useRouter();
  const [following, setFollowing] = useState<boolean | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') {
      setFollowing(false);
      return;
    }
    void api
      .get<{ isFollowedByMe?: boolean }>(checkPath)
      .then((data) => setFollowing(data.isFollowedByMe ?? false))
      .catch(() => setFollowing(false));
  }, [status, checkPath]);

  if (kind === 'authors' && user?.id === targetId) return null;

  const toggle = async () => {
    if (status !== 'authenticated') {
      router.push('/login');
      return;
    }
    const next = !following;
    setFollowing(next);
    try {
      await (next
        ? api.post(`/follows/${kind}/${targetId}`)
        : api.delete(`/follows/${kind}/${targetId}`));
    } catch {
      setFollowing(!next);
    }
  };

  return (
    <Button
      variant={following ? 'secondary' : 'primary'}
      size="sm"
      onClick={toggle}
      disabled={following === null}
    >
      {following ? 'Seguindo ✓' : 'Seguir'}
    </Button>
  );
}
