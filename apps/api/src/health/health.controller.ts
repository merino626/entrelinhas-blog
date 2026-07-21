import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness/readiness para o Render e monitores de uptime (UptimeRobot).
   * Público, sem rate limit. Confirma conectividade com o banco.
   */
  @Public()
  @SkipThrottle()
  @Get()
  async check() {
    try {
      await this.withTimeout(this.prisma.$queryRaw`SELECT 1`, 5000);
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'unreachable' });
    }
    return { status: 'ok', db: 'up', timestamp: new Date().toISOString() };
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('db timeout')), ms),
      ),
    ]);
  }
}
