import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityType, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, skipTake } from '../common/utils/pagination';
import type { AuthUser } from '../common/types';

/** Janela em que eventos iguais são agregados numa única notificação não lida. */
const AGGREGATION_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Máximo de atores exibidos ("Fulano, Beltrano e mais N curtiram..."). */
const MAX_ACTORS = 3;

export interface NotificationEvent {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  entityType: EntityType;
  entityId: string;
  meta?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Emite uma notificação com anti-flood por agregação:
   * - Se já existe notificação NÃO LIDA do mesmo tipo/entidade dentro da
   *   janela, apenas "estaca": incrementa o contador e atualiza os atores,
   *   em vez de criar uma linha nova (curtidas em massa viram UMA notificação).
   * - Repetição do mesmo ator (curtir/descurtir/curtir) não infla o contador.
   * - Ninguém é notificado das próprias ações.
   */
  async emit(event: NotificationEvent): Promise<void> {
    if (event.recipientId === event.actorId) return;

    try {
      const existing = await this.prisma.notification.findFirst({
        where: {
          recipientId: event.recipientId,
          type: event.type,
          entityType: event.entityType,
          entityId: event.entityId,
          isRead: false,
          lastEventAt: { gte: new Date(Date.now() - AGGREGATION_WINDOW_MS) },
        },
        orderBy: { lastEventAt: 'desc' },
      });

      if (existing) {
        const alreadyActor = existing.actorIds.includes(event.actorId);
        const actorIds = [
          event.actorId,
          ...existing.actorIds.filter((a) => a !== event.actorId),
        ].slice(0, MAX_ACTORS);

        await this.prisma.notification.update({
          where: { id: existing.id },
          data: {
            actorIds,
            aggregatedCount: alreadyActor ? undefined : { increment: 1 },
            lastEventAt: new Date(),
            meta: event.meta ?? (existing.meta as Prisma.InputJsonValue) ?? undefined,
          },
        });
        return;
      }

      await this.prisma.notification.create({
        data: {
          recipientId: event.recipientId,
          type: event.type,
          entityType: event.entityType,
          entityId: event.entityId,
          actorIds: [event.actorId],
          meta: event.meta,
        },
      });
    } catch (err) {
      // Notificação nunca derruba a ação principal
      this.logger.warn(`Falha ao emitir notificação: ${(err as Error).message}`);
    }
  }

  /** Notifica vários destinatários de uma vez (ex.: novo post para seguidores). */
  async emitBulk(
    recipientIds: string[],
    event: Omit<NotificationEvent, 'recipientId'>,
  ): Promise<void> {
    const unique = [...new Set(recipientIds)].filter((id) => id !== event.actorId);
    if (unique.length === 0) return;
    try {
      await this.prisma.notification.createMany({
        data: unique.map((recipientId) => ({
          recipientId,
          type: event.type,
          entityType: event.entityType,
          entityId: event.entityId,
          actorIds: [event.actorId],
          meta: event.meta,
        })),
      });
    } catch (err) {
      this.logger.warn(`Falha ao emitir notificações em massa: ${(err as Error).message}`);
    }
  }

  async list(user: AuthUser, page: number, pageSize: number) {
    const where = { recipientId: user.id };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { lastEventAt: 'desc' },
        ...skipTake(page, pageSize),
      }),
      this.prisma.notification.count({ where }),
    ]);

    // Resolve os perfis dos atores da página em uma única query
    const actorIds = [...new Set(rows.flatMap((n) => n.actorIds))];
    const actors = await this.prisma.profile.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });
    const byId = new Map(actors.map((a) => [a.id, a]));

    const items = rows.map((n) => ({
      id: n.id,
      type: n.type,
      entityType: n.entityType,
      entityId: n.entityId,
      actors: n.actorIds.map((id) => byId.get(id)).filter(Boolean),
      aggregatedCount: n.aggregatedCount,
      isRead: n.isRead,
      lastEventAt: n.lastEventAt,
      createdAt: n.createdAt,
      meta: n.meta,
    }));
    return paginate(items, total, page, pageSize);
  }

  unreadCount(user: AuthUser) {
    return this.prisma.notification
      .count({ where: { recipientId: user.id, isRead: false } })
      .then((count) => ({ count }));
  }

  async markRead(user: AuthUser, id: string): Promise<void> {
    const result = await this.prisma.notification.updateMany({
      where: { id, recipientId: user.id },
      data: { isRead: true },
    });
    if (result.count === 0) throw new NotFoundException('Notificação não encontrada.');
  }

  async markAllRead(user: AuthUser): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { recipientId: user.id, isRead: false },
      data: { isRead: true },
    });
  }
}
