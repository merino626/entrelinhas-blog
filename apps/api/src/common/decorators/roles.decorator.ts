import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Restringe a rota aos papéis informados (RBAC). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
