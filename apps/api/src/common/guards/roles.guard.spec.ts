import { ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import type { AuthUser } from '../types';

function buildContext(user?: AuthUser): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

function authUser(role: Role): AuthUser {
  return { id: 'u1', email: null, sessionId: null, profile: { role } as AuthUser['profile'] };
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  let guard: RolesGuard;

  beforeEach(() => {
    guard = new RolesGuard(reflector);
  });

  function withRequiredRoles(roles: Role[] | undefined) {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);
  }

  it('allows the request when the route has no @Roles() metadata', () => {
    withRequiredRoles(undefined);
    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it('allows the request when @Roles() was called with no arguments', () => {
    withRequiredRoles([]);
    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it('rejects when roles are required but there is no authenticated user', () => {
    withRequiredRoles(['ADMIN']);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });

  it('rejects when the user role is not in the required list', () => {
    withRequiredRoles(['ADMIN']);
    expect(() => guard.canActivate(buildContext(authUser('USER')))).toThrow(ForbiddenException);
  });

  it('allows when the user role matches one of the required roles', () => {
    withRequiredRoles(['ADMIN', 'REDATOR']);
    expect(guard.canActivate(buildContext(authUser('REDATOR')))).toBe(true);
  });
});
