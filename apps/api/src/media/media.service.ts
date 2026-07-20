import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import {
  SupabaseAdminService,
  BUCKET_POST_MEDIA,
  BUCKET_AVATARS,
} from '../supabase/supabase-admin.service';
import type { AuthUser } from '../common/types';

/**
 * Toda imagem enviada é DECODIFICADA E REENCODADA (webp) via sharp:
 * - Valida que o arquivo é de fato uma imagem (magic bytes, não extensão);
 * - Destrói payloads poliglotas (ex.: HTML/JS disfarçado de imagem);
 * - Remove metadados EXIF (incl. geolocalização);
 * - Normaliza rotação e limita dimensões.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly storage: SupabaseAdminService,
    private readonly prisma: PrismaService,
  ) {}

  private async reencode(buffer: Buffer, opts: { maxWidth: number; square?: boolean }) {
    try {
      let pipeline = sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000 }).rotate();
      if (opts.square) {
        pipeline = pipeline.resize(opts.maxWidth, opts.maxWidth, { fit: 'cover' });
      } else {
        pipeline = pipeline.resize({ width: opts.maxWidth, withoutEnlargement: true });
      }
      return await pipeline.webp({ quality: 82 }).toBuffer();
    } catch {
      throw new BadRequestException('O arquivo enviado não é uma imagem válida.');
    }
  }

  /** Imagem de conteúdo/capa de post → bucket post-media. */
  async uploadPostImage(user: AuthUser, file: Express.Multer.File) {
    const processed = await this.reencode(file.buffer, { maxWidth: 1920 });
    const path = `${user.id}/${randomUUID()}.webp`;
    const { publicUrl, storagePath } = await this.storage.uploadPublicFile(
      BUCKET_POST_MEDIA,
      path,
      processed,
      'image/webp',
    );
    return { url: publicUrl, storagePath };
  }

  /** Avatar do usuário → bucket avatars + atualiza o perfil. */
  async uploadAvatar(user: AuthUser, file: Express.Multer.File) {
    const previous = await this.prisma.profile.findUnique({
      where: { id: user.id },
      select: { avatarUrl: true },
    });

    const processed = await this.reencode(file.buffer, { maxWidth: 256, square: true });
    const path = `${user.id}/${randomUUID()}.webp`;
    const { publicUrl } = await this.storage.uploadPublicFile(
      BUCKET_AVATARS,
      path,
      processed,
      'image/webp',
    );
    const profile = await this.prisma.profile.update({
      where: { id: user.id },
      data: { avatarUrl: publicUrl },
      select: { id: true, username: true, displayName: true, avatarUrl: true, bio: true, role: true },
    });

    // Limpa o avatar anterior do Storage (best-effort)
    void this.storage.removeFileByPublicUrl(previous?.avatarUrl);

    return profile;
  }
}
