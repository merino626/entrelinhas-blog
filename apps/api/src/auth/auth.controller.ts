import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService, AuthResult } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OriginCheckGuard } from '../common/guards/origin-check.guard';
import type { AuthUser } from '../common/types';

const REFRESH_COOKIE = 'blog_rt';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      sameSite: (this.config.get<string>('COOKIE_SAMESITE') ?? 'lax') as 'lax' | 'none' | 'strict',
      path: '/api/v1/auth',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    };
  }

  private send(res: Response, result: AuthResult) {
    res.cookie(REFRESH_COOKIE, result.refreshToken, this.cookieOptions());
    return {
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
      user: this.publicUser(result.user),
    };
  }

  private publicUser(u: AuthResult['user']) {
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      role: u.role,
      createdAt: u.createdAt,
    };
  }

  private clientInfo(req: Request) {
    return {
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
      ip: req.ip ?? null,
    };
  }

  private bearerToken(req: Request): string | null {
    const header = req.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : null;
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('register')
  @HttpCode(201)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(dto, this.clientInfo(req));
    if ('needsEmailConfirmation' in result) return result;
    return this.send(res, result);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto.email, dto.password, this.clientInfo(req));
    return this.send(res, result);
  }

  @Public()
  @UseGuards(OriginCheckGuard)
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? null;
    if (!token) {
      throw new UnauthorizedException('Sem sessão ativa.');
    }
    try {
      const result = await this.auth.refresh(token, this.clientInfo(req));
      return this.send(res, result);
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, { ...this.cookieOptions(), maxAge: undefined });
      throw err;
    }
  }

  @Public()
  @UseGuards(OriginCheckGuard)
  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentUser() user: AuthUser | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(user, this.bearerToken(req));
    res.clearCookie(REFRESH_COOKIE, { ...this.cookieOptions(), maxAge: undefined });
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = this.bearerToken(req);
    if (!token) throw new UnauthorizedException();
    await this.auth.logoutAll(user, token);
    res.clearCookie(REFRESH_COOKIE, { ...this.cookieOptions(), maxAge: undefined });
  }

  @ApiBearerAuth()
  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.auth.listSessions(user);
  }

  @ApiBearerAuth()
  @Delete('sessions/:id')
  @HttpCode(204)
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.auth.revokeSession(user, id);
  }
}
