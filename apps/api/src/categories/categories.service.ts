import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/utils/slugify';
import type { AuthUser } from '../common/types';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(viewer?: AuthUser) {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            posts: { where: { status: PostStatus.PUBLISHED } },
            followers: true,
          },
        },
      },
    });

    const followedIds = viewer
      ? new Set(
          (
            await this.prisma.categoryFollow.findMany({
              where: { followerId: viewer.id },
              select: { categoryId: true },
            })
          ).map((f) => f.categoryId),
        )
      : new Set<string>();

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      postsCount: c._count.posts,
      followersCount: c._count.followers,
      isFollowedByMe: followedIds.has(c.id),
    }));
  }

  async bySlug(slug: string, viewer?: AuthUser) {
    const all = await this.list(viewer);
    const category = all.find((c) => c.slug === slug);
    if (!category) throw new NotFoundException('Categoria não encontrada.');
    return category;
  }

  async create(name: string, description?: string) {
    const slug = slugify(name);
    const existing = await this.prisma.category.findFirst({
      where: { OR: [{ name }, { slug }] },
    });
    if (existing) throw new ConflictException('Já existe uma categoria com esse nome.');
    return this.prisma.category.create({ data: { name: name.trim(), slug, description } });
  }

  async update(id: string, data: { name?: string; description?: string }) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Categoria não encontrada.');
    return this.prisma.category.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        // Slug permanece estável para não quebrar URLs já indexadas
        description: data.description,
      },
    });
  }

  async remove(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Categoria não encontrada.');
    await this.prisma.category.delete({ where: { id } });
  }
}
