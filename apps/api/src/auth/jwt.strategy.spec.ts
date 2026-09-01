import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

function makeConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
  const values: Record<string, string | undefined> = {
    SUPABASE_JWT_SECRET: 'test-secret',
    SUPABASE_URL: 'https://project.supabase.co',
    ...overrides,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function makePrisma(): PrismaService {
  return {
    profile: { findUnique: jest.fn() },
    userSession: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue(undefined) },
  } as unknown as PrismaService;
}

describe('JwtStrategy#validate', () => {
  it('rejects a token whose subject has no matching profile', async () => {
    const prisma = makePrisma();
    (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);
    const strategy = new JwtStrategy(makeConfig(), prisma);

    await expect(strategy.validate({ sub: 'u1', exp: 0 })).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token whose session has been revoked', async () => {
    const prisma = makePrisma();
    (prisma.profile.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', role: 'USER' });
    (prisma.userSession.findUnique as jest.Mock).mockResolvedValue({
      id: 's1',
      revokedAt: new Date(),
      lastSeenAt: new Date(),
    });
    const strategy = new JwtStrategy(makeConfig(), prisma);

    await expect(
      strategy.validate({ sub: 'u1', session_id: 's1', exp: 0 }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a valid token and attaches the profile + session id', async () => {
    const prisma = makePrisma();
    const profile = { id: 'u1', role: 'USER' };
    (prisma.profile.findUnique as jest.Mock).mockResolvedValue(profile);
    (prisma.userSession.findUnique as jest.Mock).mockResolvedValue({
      id: 's1',
      revokedAt: null,
      lastSeenAt: new Date(),
    });
    const strategy = new JwtStrategy(makeConfig(), prisma);

    const result = await strategy.validate({
      sub: 'u1',
      session_id: 's1',
      email: 'a@b.com',
      exp: 0,
    });

    expect(result).toEqual({ id: 'u1', email: 'a@b.com', sessionId: 's1', profile });
    expect(prisma.userSession.update).not.toHaveBeenCalled();
  });

  it('touches lastSeenAt when the session has been idle for more than 5 minutes', async () => {
    const prisma = makePrisma();
    (prisma.profile.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', role: 'USER' });
    (prisma.userSession.findUnique as jest.Mock).mockResolvedValue({
      id: 's1',
      revokedAt: null,
      lastSeenAt: new Date(Date.now() - 10 * 60 * 1000),
    });
    const strategy = new JwtStrategy(makeConfig(), prisma);

    await strategy.validate({ sub: 'u1', session_id: 's1', exp: 0 });
    await Promise.resolve();

    expect(prisma.userSession.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { lastSeenAt: expect.any(Date) },
    });
  });

  it('skips the session lookup entirely when the token carries no session_id', async () => {
    const prisma = makePrisma();
    (prisma.profile.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', role: 'USER' });
    const strategy = new JwtStrategy(makeConfig(), prisma);

    const result = await strategy.validate({ sub: 'u1', exp: 0 });

    expect(result.sessionId).toBeNull();
    expect(prisma.userSession.findUnique).not.toHaveBeenCalled();
  });
});
