import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OriginCheckGuard } from './origin-check.guard';

function buildContext(origin?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: origin ? { origin } : {} }),
    }),
  } as unknown as ExecutionContext;
}

function makeGuard(webOrigin?: string): OriginCheckGuard {
  const config = { get: () => webOrigin } as unknown as ConfigService;
  return new OriginCheckGuard(config);
}

describe('OriginCheckGuard', () => {
  it('allows requests with no Origin header (non-browser clients)', () => {
    const guard = makeGuard('http://localhost:3000');
    expect(guard.canActivate(buildContext(undefined))).toBe(true);
  });

  it('allows an origin present in WEB_ORIGIN', () => {
    const guard = makeGuard('http://localhost:3000,https://blog.example.com');
    expect(guard.canActivate(buildContext('https://blog.example.com'))).toBe(true);
  });

  it('ignores a trailing slash when comparing origins', () => {
    const guard = makeGuard('https://blog.example.com');
    expect(guard.canActivate(buildContext('https://blog.example.com/'))).toBe(true);
  });

  it('rejects an origin outside the allowlist', () => {
    const guard = makeGuard('https://blog.example.com');
    expect(() => guard.canActivate(buildContext('https://attacker.example'))).toThrow(
      ForbiddenException,
    );
  });

  it('falls back to http://localhost:3000 when WEB_ORIGIN is unset', () => {
    const guard = makeGuard(undefined);
    expect(() => guard.canActivate(buildContext('https://attacker.example'))).toThrow(
      ForbiddenException,
    );
    expect(guard.canActivate(buildContext('http://localhost:3000'))).toBe(true);
  });
});
