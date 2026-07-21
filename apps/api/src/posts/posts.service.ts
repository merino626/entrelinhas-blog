import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaType, PostStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseAdminService, BUCKET_POST_MEDIA } from '../supabase/supabase-admin.service';
import { RevalidateService } from '../revalidate/revalidate.service';
import { sanitizePostHtml, readingTimeMin, stripHtml } from '../common/utils/sanitize';
import { slugify, randomSuffix } from '../common/utils/slugify';
import { paginate, skipTake } from '../common/utils/pagination';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsQueryDto } from './dto/posts-query.dto';
import type { AuthUser } from '../common/types';

const authorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

const summaryInclude = {
  author: { select: authorSelect },
  category: { select: { id: true, name: true, slug: true } },
  _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
} satisfies Prisma.PostInclude;

type PostWithSummary = Prisma.PostGetPayload<{ include: typeof summaryInclude }>;

@Injectable()
export class PostsService {
  private readonly storagePublicPrefix: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: SupabaseAdminService,
    private readonly revalidate: RevalidateService,
    config: ConfigService,
  ) {
    this.storagePublicPrefix = `${config.get<string>('SUPABASE_URL')}/storage/v1/object/public/`;
  }

  // ── Invalidação de cache (ISR) ───────────────────────────────────────────────

  private buildPostPaths(
    slug: string,
    authorUsername: string,
    categorySlug?: string | null,
  ): string[] {
    return [
      '/',
      '/feed.xml',
      '/sitemap.xml',
      `/blog/${slug}`,
      `/autor/${authorUsername}`,
      ...(categorySlug ? [`/categoria/${categorySlug}`] : []),
    ];
  }

  /** Busca slug/autor/categoria do post e dispara revalidação best-effort. */
  private async revalidateForPost(postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        slug: true,
        author: { select: { username: true } },
        category: { select: { slug: true } },
      },
    });
    if (post) {
      this.revalidate.trigger(
        this.buildPostPaths(post.slug, post.author.username, post.category?.slug),
      );
    }
  }

  // ── Mapeamento ─────────────────────────────────────────────────────────────

  private toSummary(
    post: PostWithSummary,
    ctx?: { likedIds?: Set<string>; savedIds?: Set<string> },
  ) {
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      coverImageUrl: post.coverImageUrl,
      status: post.status,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      readingTimeMin: post.readingTimeMin,
      viewCount: post.viewCount,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      author: post.author,
      category: post.category,
      likedByMe: ctx?.likedIds?.has(post.id) ?? false,
      savedByMe: ctx?.savedIds?.has(post.id) ?? false,
    };
  }

  /** Busca em lote o que o usuário curtiu/salvou entre os posts da página. */
  private async interactionContext(userId: string | undefined, postIds: string[]) {
    if (!userId || postIds.length === 0) {
      return { likedIds: new Set<string>(), savedIds: new Set<string>() };
    }
    const [likes, saves] = await this.prisma.$transaction([
      this.prisma.postLike.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
      this.prisma.postSave.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
    ]);
    return {
      likedIds: new Set(likes.map((l) => l.postId)),
      savedIds: new Set(saves.map((s) => s.postId)),
    };
  }

  private async listWith(
    where: Prisma.PostWhereInput,
    orderBy: Prisma.PostOrderByWithRelationInput | Prisma.PostOrderByWithRelationInput[],
    page: number,
    pageSize: number,
    viewer?: AuthUser,
  ) {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        include: summaryInclude,
        orderBy,
        ...skipTake(page, pageSize),
      }),
      this.prisma.post.count({ where }),
    ]);
    const ctx = await this.interactionContext(viewer?.id, rows.map((r) => r.id));
    return paginate(rows.map((r) => this.toSummary(r, ctx)), total, page, pageSize);
  }

  // ── Listagens públicas ─────────────────────────────────────────────────────

  list(query: PostsQueryDto, viewer?: AuthUser) {
    // Busca full-text (≥ 2 chars) usa índice tsvector; caso contrário, listagem normal.
    if (query.q && query.q.trim().length >= 2) {
      return this.searchPage(query, viewer);
    }

    const where: Prisma.PostWhereInput = {
      status: PostStatus.PUBLISHED,
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.author ? { author: { username: query.author } } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { excerpt: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // "Em alta": mais vistos entre os publicados nos últimos 30 dias.
    if (query.sort === 'trending') {
      where.publishedAt = { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    }

    const orderBy: Prisma.PostOrderByWithRelationInput[] =
      query.sort === 'popular' || query.sort === 'trending'
        ? [{ viewCount: 'desc' }, { publishedAt: 'desc' }]
        : [{ publishedAt: 'desc' }];
    return this.listWith(where, orderBy, query.page, query.pageSize, viewer);
  }

  /**
   * Busca full-text ranqueada (ts_rank) sobre a coluna gerada search_vector.
   * Retorna ids ordenados por relevância, hidrata com summaryInclude e
   * preserva a ordem do ranking.
   */
  private async searchPage(query: PostsQueryDto, viewer?: AuthUser) {
    const q = query.q!.trim();
    const { page, pageSize } = query;
    const { skip, take } = skipTake(page, pageSize);

    const rows = await this.prisma.$queryRaw<{ id: string; total: bigint }[]>`
      SELECT p.id, count(*) OVER() AS total
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN profiles a ON a.id = p.author_id
      WHERE p.status = 'PUBLISHED'
        AND p.search_vector @@ websearch_to_tsquery('portuguese', ${q})
        ${query.category ? Prisma.sql`AND c.slug = ${query.category}` : Prisma.empty}
        ${query.author ? Prisma.sql`AND a.username = ${query.author}` : Prisma.empty}
      ORDER BY ts_rank(p.search_vector, websearch_to_tsquery('portuguese', ${q})) DESC,
               p.published_at DESC
      LIMIT ${take} OFFSET ${skip}
    `;

    if (rows.length === 0) return paginate([], 0, page, pageSize);

    const total = Number(rows[0].total);
    const ids = rows.map((r) => r.id);
    const posts = await this.prisma.post.findMany({
      where: { id: { in: ids } },
      include: summaryInclude,
    });
    const byId = new Map(posts.map((p) => [p.id, p]));
    const ordered = ids.map((id) => byId.get(id)).filter((p): p is PostWithSummary => !!p);

    const ctx = await this.interactionContext(viewer?.id, ids);
    return paginate(ordered.map((r) => this.toSummary(r, ctx)), total, page, pageSize);
  }

  /** Feed "para você": posts de autores e categorias que o usuário segue. */
  async feed(user: AuthUser, page: number, pageSize: number) {
    const [authorFollows, categoryFollows] = await this.prisma.$transaction([
      this.prisma.authorFollow.findMany({
        where: { followerId: user.id },
        select: { authorId: true },
      }),
      this.prisma.categoryFollow.findMany({
        where: { followerId: user.id },
        select: { categoryId: true },
      }),
    ]);
    const authorIds = authorFollows.map((f) => f.authorId);
    const categoryIds = categoryFollows.map((f) => f.categoryId);

    // Sem follows ainda → recomenda os mais recentes
    const where: Prisma.PostWhereInput =
      authorIds.length === 0 && categoryIds.length === 0
        ? { status: PostStatus.PUBLISHED }
        : {
            status: PostStatus.PUBLISHED,
            OR: [
              ...(authorIds.length ? [{ authorId: { in: authorIds } }] : []),
              ...(categoryIds.length ? [{ categoryId: { in: categoryIds } }] : []),
            ],
          };
    return this.listWith(where, [{ publishedAt: 'desc' }], page, pageSize, user);
  }

  async detailBySlug(slug: string, viewer?: AuthUser) {
    const post = await this.prisma.post.findUnique({
      where: { slug },
      include: summaryInclude,
    });
    if (!post) throw new NotFoundException('Post não encontrado.');

    const isOwnerOrAdmin =
      viewer && (viewer.id === post.authorId || viewer.profile.role === 'ADMIN');
    if (post.status !== PostStatus.PUBLISHED && !isOwnerOrAdmin) {
      throw new NotFoundException('Post não encontrado.');
    }

    // Contagem de visualização best-effort (não conta o próprio autor)
    if (post.status === PostStatus.PUBLISHED && viewer?.id !== post.authorId) {
      void this.prisma.post
        .update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } })
        .catch(() => undefined);
    }

    const ctx = await this.interactionContext(viewer?.id, [post.id]);
    return { ...this.toSummary(post, ctx), contentHtml: post.contentHtml };
  }

  // ── CMS ────────────────────────────────────────────────────────────────────

  mine(user: AuthUser, page: number, pageSize: number) {
    const where: Prisma.PostWhereInput =
      user.profile.role === 'ADMIN' ? {} : { authorId: user.id };
    return this.listWith(where, [{ updatedAt: 'desc' }], page, pageSize, user);
  }

  private async assertOwnership(postId: string, user: AuthUser) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post não encontrado.');
    if (post.authorId !== user.id && user.profile.role !== 'ADMIN') {
      throw new ForbiddenException('Você não pode alterar posts de outros autores.');
    }
    return post;
  }

  async editable(postId: string, user: AuthUser) {
    await this.assertOwnership(postId, user);
    const post = await this.prisma.post.findUniqueOrThrow({
      where: { id: postId },
      include: summaryInclude,
    });
    return {
      ...this.toSummary(post),
      contentHtml: post.contentHtml,
      contentJson: post.contentJson,
    };
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    const existing = await this.prisma.post.findUnique({ where: { slug: base } });
    return existing ? `${base}-${randomSuffix()}` : base;
  }

  private deriveExcerpt(dto: { excerpt?: string; contentHtml: string }, html: string): string {
    if (dto.excerpt?.trim()) return dto.excerpt.trim();
    return stripHtml(html).slice(0, 220);
  }

  async create(user: AuthUser, dto: CreatePostDto) {
    const html = sanitizePostHtml(dto.contentHtml);
    const publish = dto.status === 'PUBLISHED';

    const post = await this.prisma.post.create({
      data: {
        authorId: user.id,
        title: dto.title.trim(),
        slug: await this.uniqueSlug(dto.title),
        excerpt: this.deriveExcerpt(dto, html),
        contentJson: dto.contentJson as Prisma.InputJsonValue,
        contentHtml: html,
        coverImageUrl: dto.coverImageUrl,
        categoryId: dto.categoryId,
        readingTimeMin: readingTimeMin(html),
        status: publish ? PostStatus.PUBLISHED : PostStatus.DRAFT,
        publishedAt: publish ? new Date() : null,
      },
    });

    await this.syncMediaFromHtml(post.id, html);
    if (publish) {
      await this.notifyFollowers(post.id);
      void this.revalidateForPost(post.id);
    }
    return this.editable(post.id, user);
  }

  async update(postId: string, user: AuthUser, dto: UpdatePostDto) {
    const existing = await this.assertOwnership(postId, user);

    const html = dto.contentHtml !== undefined ? sanitizePostHtml(dto.contentHtml) : undefined;
    await this.prisma.post.update({
      where: { id: postId },
      data: {
        title: dto.title?.trim(),
        excerpt: dto.excerpt?.trim() || undefined,
        contentJson: dto.contentJson as Prisma.InputJsonValue | undefined,
        contentHtml: html,
        coverImageUrl: dto.coverImageUrl,
        categoryId: dto.categoryId,
        readingTimeMin: html !== undefined ? readingTimeMin(html) : undefined,
      },
    });
    if (html !== undefined) await this.syncMediaFromHtml(postId, html);

    // Capa substituída → limpa a imagem antiga do Storage (best-effort)
    if (
      dto.coverImageUrl !== undefined &&
      dto.coverImageUrl !== existing.coverImageUrl &&
      existing.coverImageUrl
    ) {
      void this.storage.removeFileByPublicUrl(existing.coverImageUrl);
    }

    // Post já publicado teve conteúdo alterado → invalida o cache público.
    if (existing.status === PostStatus.PUBLISHED) {
      void this.revalidateForPost(postId);
    }

    return this.editable(postId, user);
  }

  async publish(postId: string, user: AuthUser) {
    const post = await this.assertOwnership(postId, user);
    if (post.status === PostStatus.PUBLISHED) return this.editable(postId, user);

    const firstPublish = post.publishedAt === null;
    await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.PUBLISHED,
        publishedAt: post.publishedAt ?? new Date(),
      },
    });
    if (firstPublish) await this.notifyFollowers(postId);
    void this.revalidateForPost(postId);
    return this.editable(postId, user);
  }

  async unpublish(postId: string, user: AuthUser) {
    await this.assertOwnership(postId, user);
    await this.prisma.post.update({
      where: { id: postId },
      data: { status: PostStatus.DRAFT },
    });
    // Saiu do ar → revalida para some das listagens públicas.
    void this.revalidateForPost(postId);
    return this.editable(postId, user);
  }

  async remove(postId: string, user: AuthUser): Promise<void> {
    const post = await this.assertOwnership(postId, user);
    const wasPublished = post.status === PostStatus.PUBLISHED;
    const [media, meta] = await Promise.all([
      this.prisma.postMedia.findMany({
        where: { postId, storagePath: { not: null } },
        select: { storagePath: true },
      }),
      this.prisma.post.findUnique({
        where: { id: postId },
        select: {
          slug: true,
          author: { select: { username: true } },
          category: { select: { slug: true } },
        },
      }),
    ]);
    await this.prisma.post.delete({ where: { id: postId } });

    // Limpa arquivos órfãos do Storage (best-effort)
    const paths = media
      .map((m) => m.storagePath!)
      .filter((p) => p.startsWith(`${BUCKET_POST_MEDIA}/`))
      .map((p) => p.slice(BUCKET_POST_MEDIA.length + 1));
    void this.storage.removeFiles(BUCKET_POST_MEDIA, paths);
    void this.storage.removeFileByPublicUrl(post.coverImageUrl);

    // Post publicado foi removido → invalida o cache público.
    if (wasPublished && meta) {
      this.revalidate.trigger(
        this.buildPostPaths(meta.slug, meta.author.username, meta.category?.slug),
      );
    }
  }

  /**
   * Mantém post_media espelhando o conteúdo: imagens hospedadas no nosso
   * Storage e embeds de vídeo presentes no HTML sanitizado.
   */
  private async syncMediaFromHtml(postId: string, html: string): Promise<void> {
    const previous = await this.prisma.postMedia.findMany({
      where: { postId, storagePath: { not: null } },
      select: { storagePath: true },
    });

    const media: { type: MediaType; storagePath?: string; embedUrl?: string; position: number }[] =
      [];
    let position = 0;

    for (const match of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
      const src = match[1];
      if (src.startsWith(this.storagePublicPrefix)) {
        media.push({
          type: MediaType.IMAGE,
          storagePath: decodeURIComponent(src.slice(this.storagePublicPrefix.length)),
          position: position++,
        });
      }
    }
    for (const match of html.matchAll(/<iframe[^>]+src="([^"]+)"/g)) {
      media.push({ type: MediaType.VIDEO_EMBED, embedUrl: match[1], position: position++ });
    }

    await this.prisma.$transaction([
      this.prisma.postMedia.deleteMany({ where: { postId } }),
      ...(media.length
        ? [this.prisma.postMedia.createMany({ data: media.map((m) => ({ ...m, postId })) })]
        : []),
    ]);

    // Imagens removidas do conteúdo → limpa os arquivos órfãos do Storage (best-effort)
    const keptPaths = new Set(media.map((m) => m.storagePath).filter(Boolean));
    const orphanedPaths = previous
      .map((m) => m.storagePath!)
      .filter((p) => !keptPaths.has(p) && p.startsWith(`${BUCKET_POST_MEDIA}/`))
      .map((p) => p.slice(BUCKET_POST_MEDIA.length + 1));
    void this.storage.removeFiles(BUCKET_POST_MEDIA, orphanedPaths);
  }

  /** Notifica seguidores do autor e das categorias na primeira publicação. */
  private async notifyFollowers(postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { author: { select: { id: true, displayName: true } } },
    });
    if (!post) return;

    const authorFollowers = await this.prisma.authorFollow.findMany({
      where: { authorId: post.authorId },
      select: { followerId: true },
    });
    const categoryFollowers = post.categoryId
      ? await this.prisma.categoryFollow.findMany({
          where: { categoryId: post.categoryId },
          select: { followerId: true },
        })
      : [];

    const recipients = [
      ...authorFollowers.map((f) => f.followerId),
      ...categoryFollowers.map((f) => f.followerId),
    ];
    await this.notifications.emitBulk(recipients, {
      actorId: post.authorId,
      type: 'FOLLOWED_AUTHOR_POST',
      entityType: 'POST',
      entityId: post.id,
      meta: { slug: post.slug, title: post.title, authorName: post.author.displayName },
    });
  }

  // ── Curtidas e salvos ──────────────────────────────────────────────────────

  private async publishedPost(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, slug: true, title: true, authorId: true, status: true },
    });
    if (!post || post.status !== PostStatus.PUBLISHED) {
      throw new NotFoundException('Post não encontrado.');
    }
    return post;
  }

  async like(postId: string, user: AuthUser): Promise<void> {
    const post = await this.publishedPost(postId);
    try {
      await this.prisma.postLike.create({ data: { postId, userId: user.id } });
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError).code === 'P2002') return; // já curtiu
      throw err;
    }
    await this.notifications.emit({
      recipientId: post.authorId,
      actorId: user.id,
      type: 'POST_LIKE',
      entityType: 'POST',
      entityId: post.id,
      meta: { slug: post.slug, title: post.title },
    });
  }

  async unlike(postId: string, user: AuthUser): Promise<void> {
    await this.prisma.postLike.deleteMany({ where: { postId, userId: user.id } });
  }

  async savePost(postId: string, user: AuthUser): Promise<void> {
    await this.publishedPost(postId);
    try {
      await this.prisma.postSave.create({ data: { postId, userId: user.id } });
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError).code === 'P2002') return;
      throw err;
    }
  }

  async unsavePost(postId: string, user: AuthUser): Promise<void> {
    await this.prisma.postSave.deleteMany({ where: { postId, userId: user.id } });
  }

  /** Últimos posts curtidos pelo usuário (privado — só o dono vê). */
  async likedBy(user: AuthUser, page: number, pageSize: number) {
    const where = { userId: user.id, post: { status: PostStatus.PUBLISHED } };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.postLike.findMany({
        where,
        include: { post: { include: summaryInclude } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(page, pageSize),
      }),
      this.prisma.postLike.count({ where }),
    ]);
    const ctx = await this.interactionContext(user.id, rows.map((r) => r.postId));
    return paginate(rows.map((r) => this.toSummary(r.post, ctx)), total, page, pageSize);
  }

  /** Últimos posts salvos pelo usuário (privado). */
  async savedBy(user: AuthUser, page: number, pageSize: number) {
    const where = { userId: user.id, post: { status: PostStatus.PUBLISHED } };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.postSave.findMany({
        where,
        include: { post: { include: summaryInclude } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(page, pageSize),
      }),
      this.prisma.postSave.count({ where }),
    ]);
    const ctx = await this.interactionContext(user.id, rows.map((r) => r.postId));
    return paginate(rows.map((r) => this.toSummary(r.post, ctx)), total, page, pageSize);
  }
}
