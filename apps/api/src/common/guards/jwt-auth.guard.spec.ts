import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';

// @nestjs/passport memoizes AuthGuard('jwt') by strategy name, so this
// returns the very same class JwtAuthGuard extends — spying on its
// prototype intercepts every super.canActivate() call from the guard.
const passportCanActivate = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate');

function buildContext(headers: Record<string, string> = {}): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const reflector = new Reflector();
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard(reflector);
    passportCanActivate.mockReset();
  });

  afterAll(() => passportCanActivate.mockRestore());

  function withPublic(isPublic: boolean | undefined) {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);
  }

  it('delegates to passport on a protected route', async () => {
    withPublic(false);
    passportCanActivate.mockResolvedValue(true);

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(passportCanActivate).toHaveBeenCalledTimes(1);
  });

  it('propagates passport failures (401) on a protected route', async () => {
    withPublic(false);
    passportCanActivate.mockRejectedValue(new Error('invalid token'));

    await expect(guard.canActivate(buildContext())).rejects.toThrow('invalid token');
  });

  it('allows a @Public() route with no Authorization header, without calling passport', async () => {
    withPublic(true);

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(passportCanActivate).not.toHaveBeenCalled();
  });

  it('tries to attach the user on a @Public() route that carries a Bearer token', async () => {
    withPublic(true);
    passportCanActivate.mockResolvedValue(true);

    await expect(
      guard.canActivate(buildContext({ authorization: 'Bearer abc' })),
    ).resolves.toBe(true);
    expect(passportCanActivate).toHaveBeenCalledTimes(1);
  });

  it('stays anonymous (does not throw) on a @Public() route with an invalid Bearer token', async () => {
    withPublic(true);
    passportCanActivate.mockRejectedValue(new Error('invalid token'));

    await expect(
      guard.canActivate(buildContext({ authorization: 'Bearer bad' })),
    ).resolves.toBe(true);
  });
});
