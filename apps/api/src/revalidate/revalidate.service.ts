import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Dispara invalidação de cache ISR no frontend (Next na Vercel) de forma
 * best-effort: nunca derruba a operação principal e vira no-op sem config.
 */
@Injectable()
export class RevalidateService {
  private readonly logger = new Logger(RevalidateService.name);
  private readonly webUrl?: string;
  private readonly secret?: string;

  constructor(config: ConfigService) {
    this.webUrl = config.get<string>('WEB_URL');
    this.secret = config.get<string>('REVALIDATE_SECRET');
  }

  /** Fire-and-forget: chame com `void`. */
  trigger(paths: string[]): void {
    if (!this.webUrl || !this.secret || paths.length === 0) return;
    const unique = [...new Set(paths)];

    fetch(`${this.webUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': this.secret,
      },
      body: JSON.stringify({ paths: unique }),
      signal: AbortSignal.timeout(3000),
    }).catch((err) => {
      this.logger.warn(`Falha ao revalidar frontend: ${(err as Error).message}`);
    });
  }
}
