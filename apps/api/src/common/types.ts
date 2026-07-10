import type { Profile } from '@prisma/client';

/** Usuário autenticado anexado ao request pelo JwtStrategy. */
export interface AuthUser {
  id: string;
  /** session_id do JWT do Supabase (usado na blacklist de sessões). */
  sessionId: string | null;
  profile: Profile;
}

export interface RequestWithUser extends Express.Request {
  user?: AuthUser;
}
