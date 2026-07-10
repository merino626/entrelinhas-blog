import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../types';

/** Injeta o usuário autenticado (ou undefined em rota pública anônima). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser | undefined;
  },
);
