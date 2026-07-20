import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const BUCKET_POST_MEDIA = 'post-media';
export const BUCKET_AVATARS = 'avatars';

/**
 * Cliente Supabase com service_role — SOMENTE no backend.
 * Usado para Storage (upload/remoção) e operações administrativas de auth.
 */
@Injectable()
export class SupabaseAdminService {
  private readonly logger = new Logger(SupabaseAdminService.name);
  readonly client: SupabaseClient;
  private readonly publicUrlPrefix: string;

  constructor(config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL') ?? 'https://placeholder.supabase.co';
    const serviceKey = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey) {
      this.logger.warn(
        'SUPABASE_SERVICE_ROLE_KEY não configurada — uploads e operações admin vão falhar até preencher o .env',
      );
    }
    this.client = createClient(url, serviceKey || 'missing-service-role-key', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.publicUrlPrefix = `${url}/storage/v1/object/public/`;
  }

  async uploadPublicFile(
    bucket: string,
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ publicUrl: string; storagePath: string }> {
    const { error } = await this.client.storage.from(bucket).upload(path, buffer, {
      contentType,
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) {
      this.logger.error(`Falha no upload para ${bucket}/${path}: ${error.message}`);
      throw new InternalServerErrorException('Falha ao salvar o arquivo no storage.');
    }
    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return { publicUrl: data.publicUrl, storagePath: `${bucket}/${path}` };
  }

  /** Remoção best-effort (não derruba a operação principal se falhar). */
  async removeFiles(bucket: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await this.client.storage.from(bucket).remove(paths);
    if (error) this.logger.warn(`Falha ao remover arquivos de ${bucket}: ${error.message}`);
  }

  /**
   * Remove o arquivo apontado por uma URL pública do Storage (best-effort).
   * Usado para limpar mídia antiga (avatar, capa de post) ao ser substituída/excluída.
   * Ignora silenciosamente URLs vazias ou que não pertençam a este projeto Supabase.
   */
  async removeFileByPublicUrl(url: string | null | undefined): Promise<void> {
    if (!url || !url.startsWith(this.publicUrlPrefix)) return;
    const key = decodeURIComponent(url.slice(this.publicUrlPrefix.length));
    const slashIdx = key.indexOf('/');
    if (slashIdx === -1) return;
    const bucket = key.slice(0, slashIdx);
    const path = key.slice(slashIdx + 1);
    await this.removeFiles(bucket, [path]);
  }
}
