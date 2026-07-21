import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { FollowsService } from '../follows/follows.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PageQueryDto } from '../common/utils/pagination';
import { LIMITS } from '../common/limits';
import type { AuthUser } from '../common/types';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(LIMITS.displayName.min, LIMITS.displayName.max)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.bio.max)
  bio?: string;
}

class UpdateRoleDto {
  @IsEnum(Role)
  role: Role;
}

class DeleteMeDto {
  @IsString()
  @MaxLength(128)
  password: string;
}

class UsersQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(48)
  q?: string;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly follows: FollowsService,
  ) {}

  // Rotas estáticas antes das dinâmicas (:username)

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.me(user);
  }

  @ApiBearerAuth()
  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateMe(user, dto);
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @HttpCode(204)
  @Delete('me')
  deleteMe(@CurrentUser() user: AuthUser, @Body() dto: DeleteMeDto) {
    return this.users.deleteMe(user, dto.password);
  }

  @ApiBearerAuth()
  @Roles('ADMIN')
  @Get()
  listAll(@Query() query: UsersQueryDto) {
    return this.users.listAll(query.q, query.page, query.pageSize);
  }

  @ApiBearerAuth()
  @Roles('ADMIN')
  @Patch(':id/role')
  updateRole(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.users.updateRole(admin, id, dto.role);
  }

  @Public()
  @Get(':username')
  byUsername(@Param('username') username: string, @CurrentUser() viewer?: AuthUser) {
    return this.users.byUsername(username, viewer);
  }

  @Public()
  @Get(':username/followers')
  async followers(@Param('username') username: string, @Query() query: PageQueryDto) {
    const profile = await this.users.byUsername(username);
    return this.follows.followersOf(profile.id, query.page, query.pageSize);
  }

  @Public()
  @Get(':username/following')
  async following(@Param('username') username: string, @Query() query: PageQueryDto) {
    const profile = await this.users.byUsername(username);
    return this.follows.followingOf(profile.id, query.page, query.pageSize);
  }
}
