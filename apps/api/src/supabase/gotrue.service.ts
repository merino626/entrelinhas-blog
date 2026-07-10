import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GoTrueSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  user: { id: string; email?: string };
}

interface GoTrueErrorBody {
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
  error_code?: string;
  code?: number | string;
  weak_password?: unknown;
}

/**
 * Cliente REST do Supabase Auth (GoTrue). A API é a única que fala com o
 * GoTrue — o frontend nunca vê a anon key para fins de auth.
 */
@Injectable()
export class GoTrueService {
  private readonly baseUrl: string;
  private readonly anonKey: string;

  constructor(config: ConfigService) {
    this.baseUrl = `${config.get<string>('SUPABASE_URL')}/auth/v1`;
    this.anonKey = config.get<string>('SUPABASE_ANON_KEY') ?? '';
  }

  private async request<T>(
    path: string,
    init: { method: string; body?: unknown; accessToken?: string },
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: init.method,
      headers: {
        apikey: this.anonKey,
        'Content-Type': 'application/json',
        ...(init.accessToken ? { Authorization: `Bearer ${init.accessToken}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    if (!res.ok) {
      throw this.mapError(res.status, (body ?? {}) as GoTrueErrorBody);
    }
    return body as T;
  }

  private mapError(status: number, body: GoTrueErrorBody): Error {
    const raw =
      body.error_description ?? body.msg ?? body.message ?? body.error ?? 'Erro de autenticação';
    const code = String(body.error_code ?? '');

    const friendly: Record<string, string> = {
      invalid_credentials: 'E-mail ou senha incorretos.',
      email_not_confirmed: 'Confirme seu e-mail antes de entrar.',
      user_already_exists: 'Já existe uma conta com este e-mail.',
      email_exists: 'Já existe uma conta com este e-mail.',
      weak_password: 'A senha não atende aos requisitos mínimos.',
      over_request_rate_limit: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
      refresh_token_not_found: 'Sessão expirada. Entre novamente.',
      refresh_token_already_used: 'Sessão inválida (possível reuso de token). Entre novamente.',
      session_not_found: 'Sessão expirada. Entre novamente.',
    };
    const message = friendly[code] ?? raw;

    if (status === 400 || status === 422) return new BadRequestException(message);
    if (status === 401 || status === 403) return new UnauthorizedException(message);
    if (status === 429)
      return new BadRequestException('Muitas tentativas. Aguarde e tente novamente.');
    return new InternalServerErrorException('Erro no serviço de autenticação.');
  }

  signUp(email: string, password: string, meta: { username: string; display_name: string }) {
    return this.request<GoTrueSession | { id: string; email: string }>('/signup', {
      method: 'POST',
      body: { email, password, data: meta },
    });
  }

  signInWithPassword(email: string, password: string) {
    return this.request<GoTrueSession>('/token?grant_type=password', {
      method: 'POST',
      body: { email, password },
    });
  }

  refresh(refreshToken: string) {
    return this.request<GoTrueSession>('/token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: refreshToken },
    });
  }

  /** scope: local = sessão atual; global = todas as sessões do usuário. */
  async signOut(accessToken: string, scope: 'local' | 'global' = 'local'): Promise<void> {
    try {
      await this.request<void>(`/logout?scope=${scope}`, { method: 'POST', accessToken });
    } catch {
      // Logout é best-effort: token pode já estar expirado/revogado
    }
  }
}
