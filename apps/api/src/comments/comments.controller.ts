import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { CommentsService } from './comments.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PageQueryDto } from '../common/utils/pagination';
import { LIMITS } from '../common/limits';
import type { AuthUser } from '../common/types';

class CreateCommentDto {
  @IsString()
  @Length(LIMITS.comment.min, LIMITS.comment.max)
  content: string;

  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}

class ReactionDto {
  @IsIn(['LIKE', 'DISLIKE'])
  type: 'LIKE' | 'DISLIKE';
}

class CommentsPageDto extends PageQueryDto {}

@ApiTags('comments')
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Public()
  @Get('posts/:postId/comments')
  list(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query() query: CommentsPageDto,
    @CurrentUser() viewer?: AuthUser,
  ) {
    return this.comments.listByPost(postId, query.page, query.pageSize, viewer);
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post('posts/:postId/comments')
  create(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(postId, user, dto);
  }

  @ApiBearerAuth()
  @Delete('comments/:id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.comments.remove(id, user);
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Put('comments/:id/reaction')
  @HttpCode(204)
  react(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReactionDto,
  ) {
    return this.comments.react(id, user, dto.type);
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Delete('comments/:id/reaction')
  @HttpCode(204)
  unreact(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.comments.unreact(id, user);
  }
}
