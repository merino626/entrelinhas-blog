import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { GoTrueService } from '../supabase/gotrue.service';
import { PrismaService } from '../prisma/prisma.service';

function makeConfig(webOrigin?: string): ConfigService {
  return { get: () => webOrigin } as unknown as ConfigService;
}

function makeGoTrue(): GoTrueService {
  return {
    recover: jest.fn().mockResolvedValue(undefined),
    updatePassword: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com' }),
  } as unknown as GoTrueService;
}

describe('AuthService — password recovery', () => {
  describe('forgotPassword', () => {
    it('asks GoTrue to send the recovery e-mail, pointing at /redefinir-senha', async () => {
      const gotrue = makeGoTrue();
      const service = new AuthService(
        {} as PrismaService,
        gotrue,
        makeConfig('https://blog.example.com,https://other.example.com'),
      );

      await service.forgotPassword('user@example.com');

      expect(gotrue.recover).toHaveBeenCalledWith(
        'user@example.com',
        'https://blog.example.com/redefinir-senha',
      );
    });

    it('falls back to http://localhost:3000 when WEB_ORIGIN is unset', async () => {
      const gotrue = makeGoTrue();
      const service = new AuthService({} as PrismaService, gotrue, makeConfig(undefined));

      await service.forgotPassword('user@example.com');

      expect(gotrue.recover).toHaveBeenCalledWith(
        'user@example.com',
        'http://localhost:3000/redefinir-senha',
      );
    });

    it('never throws, even when GoTrue fails (avoids leaking whether the e-mail exists)', async () => {
      const gotrue = makeGoTrue();
      (gotrue.recover as jest.Mock).mockRejectedValue(new Error('boom'));
      const service = new AuthService({} as PrismaService, gotrue, makeConfig('https://x.com'));

      await expect(service.forgotPassword('user@example.com')).resolves.toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    it('forwards the recovery token and new password to GoTrue', async () => {
      const gotrue = makeGoTrue();
      const service = new AuthService({} as PrismaService, gotrue, makeConfig('https://x.com'));

      await service.resetPassword('recovery.jwt.token', 'NovaSenha123');

      expect(gotrue.updatePassword).toHaveBeenCalledWith('recovery.jwt.token', 'NovaSenha123');
    });

    it('propagates GoTrue failures (e.g. expired/invalid token)', async () => {
      const gotrue = makeGoTrue();
      (gotrue.updatePassword as jest.Mock).mockRejectedValue(new Error('invalid token'));
      const service = new AuthService({} as PrismaService, gotrue, makeConfig('https://x.com'));

      await expect(service.resetPassword('bad.jwt.token', 'NovaSenha123')).rejects.toThrow(
        'invalid token',
      );
    });
  });
});
