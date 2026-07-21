import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PostStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GoTrueService } from '../supabase/gotrue.service';
import {
  SupabaseAdminService,
  BUCKET_POST_MEDIA,
} from '../supabase/supabase-admin.service';
import { paginate, skipTake } from '../common/utils/pagination';
import type { AuthUser } from '../common/types';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gotrue: GoTrueService,
    private readonly supabaseAdmin: SupabaseAdminService,
  ) {}

  private async withCounts(profileId: string) {
    const [followers, following, posts] = await this.prisma.$transaction([
      this.prisma.authorFollow.count({ where: { authorId: profileId } }),
      this.prisma.authorFollow.count({ where: { followerId: profileId } }),
      this.prisma.post.count({
        where: { authorId: profileId, status: PostStatus.PUBLISHED },
      }),
    ]);
    return { followersCount: followers, followingCount: following, postsCount: posts };
  }

  async me(user: AuthUser) {
    const counts = await this.withCounts(user.id);
    const p = user.profile;
    return {
      id: p.id,
      username: p.username,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      bio: p.bio,
      role: p.role,
      createdAt: p.createdAt,
      ...counts,
    };
  }

  async updateMe(user: AuthUser, data: { displayName?: string; bio?: string }) {
    await this.prisma.profile.update({
      where: { id: user.id },
      data: {
        displayName: data.displayName?.trim(),
        bio: data.bio?.trim(),
      },
    });
    return this.me({
      ...user,
      profile: await this.prisma.profile.findUniqueOrThrow({ where: { id: user.id } }),
    });
  }

  /** Perfil público por username (global). */
  async byUsername(username: string, viewer?: AuthUser) {
    const profile = await this.prisma.profile.findUnique({ where: { username } });
    if (!profile) throw new NotFoundException('Perfil não encontrado.');

    const counts = await this.withCounts(profile.id);
    const isFollowedByMe = viewer
      ? (await this.prisma.authorFollow.findUnique({
          where: {
            followerId_authorId: { followerId: viewer.id, authorId: profile.id },
          },
        })) !== null
      : false;

    return {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      role: profile.role,
      createdAt: profile.createdAt,
      ...counts,
      isFollowedByMe,
    };
  }

  /**
   * Exclui a própria conta (LGPD). Reverifica a senha, remove o usuário no
   * GoTrue (cascade no banco: profile → posts → media → comentários → …) e
   * limpa os arquivos do Storage, que o cascade do banco não alcança.
   */
  async deleteMe(user: AuthUser, password: string): Promise<void> {
    // Anti-lockout: o último admin não pode se excluir sozinho.
    if (user.profile.role === Role.ADMIN) {
      const admins = await this.prisma.profile.count({ where: { role: Role.ADMIN } });
      if (admins <= 1) {
        throw new BadRequestException(
          'Você é o único administrador. Promova outro antes de excluir a conta.',
        );
      }
    }

    // Reverifica a senha (protege contra exclusão por sessão sequestrada).
    if (!user.email) {
      throw new BadRequestException('Não foi possível verificar sua identidade.');
    }
    let accessToken: string;
    try {
      const session = await this.gotrue.signInWithPassword(user.email, password);
      accessToken = session.access_token;
    } catch {
      throw new UnauthorizedException('Senha incorreta.');
    }
    void this.gotrue.signOut(accessToken, 'local');

    // Coleta os arquivos do Storage ANTES de apagar.
    const [media, posts] = await this.prisma.$transaction([
      this.prisma.postMedia.findMany({
        where: { post: { authorId: user.id }, storagePath: { not: null } },
        select: { storagePath: true },
      }),
      this.prisma.post.findMany({
        where: { authorId: user.id, coverImageUrl: { not: null } },
        select: { coverImageUrl: true },
      }),
    ]);

    // Apaga o usuário no GoTrue → cascade limpa profile/posts/media/etc no banco.
    const { error } = await this.supabaseAdmin.client.auth.admin.deleteUser(user.id);
    if (error) {
      throw new InternalServerErrorException('Falha ao excluir a conta.');
    }

    // Limpa o Storage (best-effort).
    const mediaPaths = media
      .map((m) => m.storagePath!)
      .filter((p) => p.startsWith(`${BUCKET_POST_MEDIA}/`))
      .map((p) => p.slice(BUCKET_POST_MEDIA.length + 1));
    void this.supabaseAdmin.removeFiles(BUCKET_POST_MEDIA, mediaPaths);
    for (const p of posts) void this.supabaseAdmin.removeFileByPublicUrl(p.coverImageUrl);
    void this.supabaseAdmin.removeFileByPublicUrl(user.profile.avatarUrl);
  }

  // ── Administração ──────────────────────────────────────────────────────────

  async listAll(q: string | undefined, page: number, pageSize: number) {
    const where: Prisma.ProfileWhereInput = q
      ? {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.profile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
          _count: { select: { posts: true, comments: true } },
        },
        ...skipTake(page, pageSize),
      }),
      this.prisma.profile.count({ where }),
    ]);
    return paginate(
      rows.map((r) => ({
        id: r.id,
        username: r.username,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        role: r.role,
        createdAt: r.createdAt,
        postsCount: r._count.posts,
        commentsCount: r._count.comments,
      })),
      total,
      page,
      pageSize,
    );
  }

  /** Promove/rebaixa papel. Admin não pode alterar o próprio (evita lockout). */
  async updateRole(admin: AuthUser, targetId: string, role: Role) {
    if (targetId === admin.id) {
      throw new BadRequestException('Você não pode alterar o seu próprio papel.');
    }
    const target = await this.prisma.profile.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('Usuário não encontrado.');
    return this.prisma.profile.update({
      where: { id: targetId },
      data: { role },
      select: { id: true, username: true, displayName: true, role: true },
    });
  }
}
