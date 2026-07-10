import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsQueryDto } from './dto/posts-query.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PageQueryDto } from '../common/utils/pagination';
import type { AuthUser } from '../common/types';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  // ── Público ────────────────────────────────────────────────────────────────

  @Public()
  @Get()
  list(@Query() query: PostsQueryDto, @CurrentUser() viewer?: AuthUser) {
    return this.posts.list(query, viewer);
  }

  @ApiBearerAuth()
  @Get('feed')
  feed(@CurrentUser() user: AuthUser, @Query() query: PageQueryDto) {
    return this.posts.feed(user, query.page, query.pageSize);
  }

  @ApiBearerAuth()
  @Roles('REDATOR', 'ADMIN')
  @Get('mine')
  mine(@CurrentUser() user: AuthUser, @Query() query: PageQueryDto) {
    return this.posts.mine(user, query.page, query.pageSize);
  }

  @ApiBearerAuth()
  @Get('liked')
  liked(@CurrentUser() user: AuthUser, @Query() query: PageQueryDto) {
    return this.posts.likedBy(user, query.page, query.pageSize);
  }

  @ApiBearerAuth()
  @Get('saved')
  saved(@CurrentUser() user: AuthUser, @Query() query: PageQueryDto) {
    return this.posts.savedBy(user, query.page, query.pageSize);
  }

  @Public()
  @Get('slug/:slug')
  detail(@Param('slug') slug: string, @CurrentUser() viewer?: AuthUser) {
    return this.posts.detailBySlug(slug, viewer);
  }

  // ── CMS (redator/admin) ────────────────────────────────────────────────────

  @ApiBearerAuth()
  @Roles('REDATOR', 'ADMIN')
  @Get(':id/edit')
  editable(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.posts.editable(id, user);
  }

  @ApiBearerAuth()
  @Roles('REDATOR', 'ADMIN')
  @Throttle({ default: { ttl: 60_000, limit: 12 } })
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    return this.posts.create(user, dto);
  }

  @ApiBearerAuth()
  @Roles('REDATOR', 'ADMIN')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePostDto,
  ) {
    return this.posts.update(id, user, dto);
  }

  @ApiBearerAuth()
  @Roles('REDATOR', 'ADMIN')
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.posts.remove(id, user);
  }

  @ApiBearerAuth()
  @Roles('REDATOR', 'ADMIN')
  @Post(':id/publish')
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.posts.publish(id, user);
  }

  @ApiBearerAuth()
  @Roles('REDATOR', 'ADMIN')
  @Post(':id/unpublish')
  unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.posts.unpublish(id, user);
  }

  // ── Interações (qualquer usuário autenticado) ──────────────────────────────

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post(':id/like')
  @HttpCode(204)
  like(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.posts.like(id, user);
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Delete(':id/like')
  @HttpCode(204)
  unlike(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.posts.unlike(id, user);
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post(':id/save')
  @HttpCode(204)
  savePost(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.posts.savePost(id, user);
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Delete(':id/save')
  @HttpCode(204)
  unsavePost(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.posts.unsavePost(id, user);
  }
}
