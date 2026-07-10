import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LIMITS } from '../common/limits';
import type { AuthUser } from '../common/types';

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Roles('REDATOR', 'ADMIN')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: LIMITS.uploadImageMaxBytes, files: 1 } }),
  )
  uploadPostImage(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Envie um arquivo no campo "file".');
    return this.media.uploadPostImage(user, file);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: LIMITS.avatarMaxBytes, files: 1 } }),
  )
  uploadAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Envie um arquivo no campo "file".');
    return this.media.uploadAvatar(user, file);
  }
}
