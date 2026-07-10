import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { paginate, skipTake } from '../common/utils/pagination';
import type { AuthUser } from '../common/types';

const profileSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
} as const;

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async followAuthor(user: AuthUser, authorId: string): Promise<void> {
    if (authorId === user.id) {
      throw new BadRequestException('Você não pode seguir a si mesmo.');
    }
    const target = await this.prisma.profile.findUnique({ where: { id: authorId } });
    if (!target) throw new NotFoundException('Autor não encontrado.');

    try {
      await this.prisma.authorFollow.create({
        data: { followerId: user.id, authorId },
      });
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError).code === 'P2002') return; // já segue
      throw err;
    }
    await this.notifications.emit({
      recipientId: authorId,
      actorId: user.id,
      type: 'NEW_FOLLOWER',
      entityType: 'PROFILE',
      entityId: authorId,
      meta: { username: user.profile.username },
    });
  }

  async unfollowAuthor(user: AuthUser, authorId: string): Promise<void> {
    await this.prisma.authorFollow.deleteMany({
      where: { followerId: user.id, authorId },
    });
  }

  async followCategory(user: AuthUser, categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Categoria não encontrada.');
    try {
      await this.prisma.categoryFollow.create({
        data: { followerId: user.id, categoryId },
      });
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError).code === 'P2002') return;
      throw err;
    }
  }

  async unfollowCategory(user: AuthUser, categoryId: string): Promise<void> {
    await this.prisma.categoryFollow.deleteMany({
      where: { followerId: user.id, categoryId },
    });
  }

  /** Quem segue este perfil. */
  async followersOf(profileId: string, page: number, pageSize: number) {
    const where = { authorId: profileId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.authorFollow.findMany({
        where,
        include: { follower: { select: profileSelect } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(page, pageSize),
      }),
      this.prisma.authorFollow.count({ where }),
    ]);
    return paginate(rows.map((r) => r.follower), total, page, pageSize);
  }

  /** Quem este perfil segue. */
  async followingOf(profileId: string, page: number, pageSize: number) {
    const where = { followerId: profileId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.authorFollow.findMany({
        where,
        include: { author: { select: profileSelect } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(page, pageSize),
      }),
      this.prisma.authorFollow.count({ where }),
    ]);
    return paginate(rows.map((r) => r.author), total, page, pageSize);
  }
}
