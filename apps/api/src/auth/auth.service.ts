import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Profile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GoTrueService, GoTrueSession } from '../supabase/gotrue.service';
import { LIMITS, RESERVED_USERNAMES } from '../common/limits';
import { RegisterDto } from './dto/register.dto';
import type { AuthUser } from '../common/types';

export interface ClientInfo {
  userAgent: string | null;
  ip: string | null;
}

export interface AuthResult {
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
  user: Profile;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gotrue: GoTrueService,
  ) {}

  private async assertUsernameAvailable(username: string): Promise<void> {
    if (RESERVED_USERNAMES.has(username)) {
      throw new ConflictException('Este username não está disponível.');
    }
    const existing = await this.prisma.profile.findUnique({ where: { username } });
    if (existing) {
      throw new ConflictException('Este username já está em uso.');
    }
  }

  /**
   * Registra a sessão localmente (tabela user_sessions) — é a base da
   * listagem de dispositivos e da blacklist de sessões revogadas.
   */
  private async trackSession(session: GoTrueSession, client: ClientInfo): Promise<string | null> {
    const payload = decodeJwtPayload(session.access_token);
    const sessionId = typeof payload.session_id === 'string' ? payload.session_id : null;
    if (!sessionId) return null;

    await this.prisma.userSession.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        userId: session.user.id,
        userAgent: client.userAgent?.slice(0, 512) ?? null,
        ip: client.ip,
      },
      update: { lastSeenAt: new Date() },
    });
    return sessionId;
  }

  private async toAuthResult(session: GoTrueSession): Promise<AuthResult> {
    const user = await this.prisma.profile.findUnique({ where: { id: session.user.id } });
    if (!user) {
      throw new UnauthorizedException('Perfil não encontrado para este usuário.');
    }
    return {
      accessToken: session.access_token,
      expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
      refreshToken: session.refresh_token,
      user,
    };
  }

  async register(
    dto: RegisterDto,
    client: ClientInfo,
  ): Promise<{ needsEmailConfirmation: true } | AuthResult> {
    await this.assertUsernameAvailable(dto.username);

    const result = await this.gotrue.signUp(dto.email, dto.password, {
      username: dto.username,
      display_name: dto.displayName.trim(),
    });

    // Com confirmação de e-mail habilitada o GoTrue não devolve sessão
    if (!('access_token' in result)) {
      return { needsEmailConfirmation: true };
    }
    await this.trackSession(result, client);
    return this.toAuthResult(result);
  }

  async login(email: string, password: string, client: ClientInfo): Promise<AuthResult> {
    const session = await this.gotrue.signInWithPassword(email, password);
    await this.trackSession(session, client);
    return this.toAuthResult(session);
  }

  async refresh(refreshToken: string, client: ClientInfo): Promise<AuthResult> {
    const session = await this.gotrue.refresh(refreshToken);

    const payload = decodeJwtPayload(session.access_token);
    const sessionId = typeof payload.session_id === 'string' ? payload.session_id : null;
    if (sessionId) {
      const tracked = await this.prisma.userSession.findUnique({ where: { id: sessionId } });
      if (tracked?.revokedAt) {
        // Sessão está na blacklist — invalida também no GoTrue (best-effort)
        await this.gotrue.signOut(session.access_token, 'local');
        throw new UnauthorizedException('Sessão revogada. Entre novamente.');
      }
    }
    await this.trackSession(session, client);
    return this.toAuthResult(session);
  }

  async logout(user: AuthUser | undefined, accessToken: string | null): Promise<void> {
    if (user?.sessionId) {
      await this.prisma.userSession.updateMany({
        where: { id: user.sessionId, userId: user.id },
        data: { revokedAt: new Date() },
      });
    }
    if (accessToken) {
      await this.gotrue.signOut(accessToken, 'local');
    }
  }

  async logoutAll(user: AuthUser, accessToken: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.gotrue.signOut(accessToken, 'global');
  }

  async listSessions(user: AuthUser) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
      take: 30,
    });
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      current: s.id === user.sessionId,
    }));
  }

  async revokeSession(user: AuthUser, sessionId: string): Promise<void> {
    const result = await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new UnauthorizedException('Sessão não encontrada.');
    }
  }

  passwordPolicy() {
    return LIMITS.password;
  }
}
