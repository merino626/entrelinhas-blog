import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types';

interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  session_id?: string;
  exp: number;
}

const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Valida o access token emitido pelo Supabase Auth.
 * - HS256 com SUPABASE_JWT_SECRET (projetos legados), ou
 * - JWKS assimétrico em /auth/v1/.well-known/jwks.json (signing keys novos).
 * Depois checa a blacklist de sessões revogadas (user_sessions.revoked_at).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = config.get<string>('SUPABASE_JWT_SECRET');
    const supabaseUrl = config.get<string>('SUPABASE_URL');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      ...(secret
        ? { secretOrKey: secret, algorithms: ['HS256'] }
        : {
            secretOrKeyProvider: passportJwtSecret({
              jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
              cache: true,
              rateLimit: true,
              jwksRequestsPerMinute: 10,
            }),
            algorithms: ['ES256', 'RS256'],
          }),
    });
  }

  async validate(payload: SupabaseJwtPayload): Promise<AuthUser> {
    const profile = await this.prisma.profile.findUnique({ where: { id: payload.sub } });
    if (!profile) {
      throw new UnauthorizedException('Perfil não encontrado.');
    }

    const sessionId = payload.session_id ?? null;
    if (sessionId) {
      const session = await this.prisma.userSession.findUnique({ where: { id: sessionId } });
      if (session?.revokedAt) {
        throw new UnauthorizedException('Sessão revogada. Entre novamente.');
      }
      // Atualiza "visto por último" no máximo a cada 5 min (evita write por request)
      if (
        session &&
        Date.now() - session.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS
      ) {
        void this.prisma.userSession
          .update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } })
          .catch(() => undefined);
      }
    }

    return { id: profile.id, email: payload.email ?? null, sessionId, profile };
  }
}
