import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';
import { LIMITS } from '../../common/limits';

export class CreatePostDto {
  @IsString()
  @Length(LIMITS.postTitle.min, LIMITS.postTitle.max)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.postExcerpt.max)
  excerpt?: string;

  /** Documento Tiptap (JSON) — guardado para reedição, nunca renderizado cru. */
  @IsObject()
  contentJson: Record<string, unknown>;

  /** HTML do editor — será sanitizado (allow-list) antes de persistir. */
  @IsString()
  @MaxLength(300_000)
  contentHtml: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  coverImageUrl?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED'])
  status?: 'DRAFT' | 'PUBLISHED';
}
