import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FollowsModule } from '../follows/follows.module';

@Module({
  imports: [FollowsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
