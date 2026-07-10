import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostStatus, Prisma, ReactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LIMITS } from '../common/limits';
import { paginate, skipTake } from '../common/utils/pagination';
import type { AuthUser } from '../common/types';

const authorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Thread única do post, em ordem cronológica. Respostas guardam
   * parent_comment_id + mentioned_user_id (o @ é montado no front).
   */
  async listByPost(postId: string, page: number, pageSize: number, viewer?: AuthUser) {
    const where = { postId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: authorSelect },
          mentionedUser: { select: { id: true, username: true, displayName: true } },
        },
        ...skipTake(page, pageSize),
      }),
      this.prisma.comment.count({ where }),
    ]);

    const ids = rows.map((c) => c.id);
    const reactionCounts = ids.length
      ? await this.prisma.commentReaction.groupBy({
          by: ['commentId', 'type'],
          where: { commentId: { in: ids } },
          _count: true,
        })
      : [];
    const myReactions =
      viewer && ids.length
        ? await this.prisma.commentReaction.findMany({
            where: { userId: viewer.id, commentId: { in: ids } },
          })
        : [];
    const countOf = (id: string, type: ReactionType) =>
      reactionCounts.find((r) => r.commentId === id && r.type === type)?._count ?? 0;
    const mineOf = (id: string) => myReactions.find((r) => r.commentId === id)?.type ?? null;

    const items = rows.map((c) => {
      const deleted = c.deletedAt !== null;
      return {
        id: c.id,
        postId: c.postId,
        content: deleted ? '' : c.content,
        createdAt: c.createdAt,
        deleted,
        author: deleted ? null : c.author,
        parentCommentId: c.parentCommentId,
        mentionedUser: deleted ? null : c.mentionedUser,
        likesCount: countOf(c.id, 'LIKE'),
        dislikesCount: countOf(c.id, 'DISLIKE'),
        myReaction: mineOf(c.id),
      };
    });
    return paginate(items, total, page, pageSize);
  }

  async create(
    postId: string,
    user: AuthUser,
    dto: { content: string; parentCommentId?: string },
  ) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, slug: true, title: true, authorId: true, status: true },
    });
    if (!post || post.status !== PostStatus.PUBLISHED) {
      throw new NotFoundException('Post não encontrado.');
    }

    // Anti-spam: intervalo mínimo entre comentários do mesmo usuário
    const lastComment = await this.prisma.comment.findFirst({
      where: { authorId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (
      lastComment &&
      Date.now() - lastComment.createdAt.getTime() < LIMITS.commentMinIntervalMs
    ) {
      throw new BadRequestException('Aguarde alguns segundos antes de comentar novamente.');
    }

    // Anti-spam: limite de links por comentário
    const linkCount = (dto.content.match(/https?:\/\//gi) ?? []).length;
    if (linkCount > LIMITS.commentMaxLinks) {
      throw new BadRequestException(
        `Máximo de ${LIMITS.commentMaxLinks} links por comentário.`,
      );
    }

    let mentionedUserId: string | null = null;
    let parentAuthorId: string | null = null;
    if (dto.parentCommentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentCommentId },
        select: { id: true, postId: true, authorId: true, deletedAt: true },
      });
      if (!parent || parent.postId !== postId || parent.deletedAt) {
        throw new BadRequestException('Comentário respondido não existe mais.');
      }
      mentionedUserId = parent.authorId;
      parentAuthorId = parent.authorId;
    }

    const comment = await this.prisma.comment.create({
      data: {
        postId,
        authorId: user.id,
        content: dto.content.trim(),
        parentCommentId: dto.parentCommentId ?? null,
        mentionedUserId,
      },
      include: {
        author: { select: authorSelect },
        mentionedUser: { select: { id: true, username: true, displayName: true } },
      },
    });

    // Resposta → notifica o autor do comentário pai; raiz → autor do post
    const meta = { slug: post.slug, title: post.title, commentId: comment.id };
    if (parentAuthorId) {
      await this.notifications.emit({
        recipientId: parentAuthorId,
        actorId: user.id,
        type: 'COMMENT_REPLY',
        entityType: 'COMMENT',
        entityId: dto.parentCommentId!,
        meta,
      });
    } else {
      await this.notifications.emit({
        recipientId: post.authorId,
        actorId: user.id,
        type: 'COMMENT_REPLY',
        entityType: 'POST',
        entityId: post.id,
        meta,
      });
    }

    return {
      id: comment.id,
      postId: comment.postId,
      content: comment.content,
      createdAt: comment.createdAt,
      deleted: false,
      author: comment.author,
      parentCommentId: comment.parentCommentId,
      mentionedUser: comment.mentionedUser,
      likesCount: 0,
      dislikesCount: 0,
      myReaction: null,
    };
  }

  /** Soft delete: mantém a posição na thread, remove conteúdo e autoria. */
  async remove(commentId: string, user: AuthUser): Promise<void> {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) throw new NotFoundException('Comentário não encontrado.');
    if (comment.authorId !== user.id && user.profile.role !== 'ADMIN') {
      throw new ForbiddenException('Você não pode remover comentários de outras pessoas.');
    }
    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }

  async react(commentId: string, user: AuthUser, type: ReactionType): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        authorId: true,
        deletedAt: true,
        post: { select: { slug: true, title: true } },
      },
    });
    if (!comment || comment.deletedAt) throw new NotFoundException('Comentário não encontrado.');

    // Trocar de reação faz UPDATE — nunca duplica (PK composta comment+user)
    await this.prisma.commentReaction.upsert({
      where: { commentId_userId: { commentId, userId: user.id } },
      create: { commentId, userId: user.id, type },
      update: { type },
    });

    // Só reação positiva notifica (evita usar notificação como assédio)
    if (type === 'LIKE') {
      await this.notifications.emit({
        recipientId: comment.authorId,
        actorId: user.id,
        type: 'COMMENT_REACTION',
        entityType: 'COMMENT',
        entityId: comment.id,
        meta: { slug: comment.post.slug, title: comment.post.title, commentId: comment.id },
      });
    }
  }

  async unreact(commentId: string, user: AuthUser): Promise<void> {
    await this.prisma.commentReaction.deleteMany({
      where: { commentId, userId: user.id },
    });
  }
}

export type { Prisma };
