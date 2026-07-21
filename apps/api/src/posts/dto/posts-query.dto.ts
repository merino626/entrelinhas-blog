import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/utils/pagination';

export class PostsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  /** Slug da categoria. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  /** Username do autor. */
  @IsOptional()
  @IsString()
  @MaxLength(24)
  author?: string;

  @IsOptional()
  @IsIn(['recent', 'popular', 'trending'])
  sort?: 'recent' | 'popular' | 'trending';
}
