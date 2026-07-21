import type { Profile } from '@prisma/client';

/** Usuário autenticado anexado ao request pelo JwtStrategy. */
export interface AuthUser {
  id: string;
  /** E-mail do JWT (auth.users) — usado para reverificar senha em ações sensíveis. */
  email: string | null;
  /** session_id do JWT do Supabase (usado na blacklist de sessões). */
  sessionId: string | null;
  profile: Profile;
}

export interface RequestWithUser extends Express.Request {
  user?: AuthUser;
}
