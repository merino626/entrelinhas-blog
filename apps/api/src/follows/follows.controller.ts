import { Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FollowsService } from './follows.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types';

@ApiTags('follows')
@ApiBearerAuth()
@Throttle({ default: { ttl: 60_000, limit: 30 } })
@Controller('follows')
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  @Post('authors/:id')
  @HttpCode(204)
  followAuthor(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.follows.followAuthor(user, id);
  }

  @Delete('authors/:id')
  @HttpCode(204)
  unfollowAuthor(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.follows.unfollowAuthor(user, id);
  }

  @Post('categories/:id')
  @HttpCode(204)
  followCategory(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.follows.followCategory(user, id);
  }

  @Delete('categories/:id')
  @HttpCode(204)
  unfollowCategory(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.follows.unfollowCategory(user, id);
  }
}
