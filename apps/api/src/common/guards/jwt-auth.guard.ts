import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard global de autenticação.
 * - Rota normal: exige Bearer token válido (401 caso contrário).
 * - Rota @Public(): sempre permite, mas se houver Bearer token tenta
 *   validá-lo para dar contexto de usuário (likedByMe, isFollowedByMe etc.).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isPublic) {
      return (await super.canActivate(context)) as boolean;
    }

    const req = context.switchToHttp().getRequest();
    if (typeof req.headers?.authorization === 'string') {
      try {
        await super.canActivate(context);
      } catch {
        // Token inválido/expirado em rota pública → segue como anônimo
      }
    }
    return true;
  }
}
