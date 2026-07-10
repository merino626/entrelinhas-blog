import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Proteção CSRF para as rotas que dependem APENAS do cookie httpOnly
 * (refresh/logout): se o header Origin vier presente, precisa pertencer
 * à allowlist. As demais rotas usam Bearer token no header Authorization,
 * que um site atacante não consegue forjar cross-site.
 */
@Injectable()
export class OriginCheckGuard implements CanActivate {
  private readonly allowed: Set<string>;

  constructor(config: ConfigService) {
    this.allowed = new Set(
      (config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000')
        .split(',')
        .map((o) => o.trim().replace(/\/$/, '')),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const origin = (req.headers.origin as string | undefined)?.replace(/\/$/, '');
    if (origin && !this.allowed.has(origin)) {
      throw new ForbiddenException('Origem não permitida.');
    }
    return true;
  }
}
