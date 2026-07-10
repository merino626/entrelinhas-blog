import { Global, Module } from '@nestjs/common';
import { GoTrueService } from './gotrue.service';
import { SupabaseAdminService } from './supabase-admin.service';

@Global()
@Module({
  providers: [GoTrueService, SupabaseAdminService],
  exports: [GoTrueService, SupabaseAdminService],
})
export class SupabaseModule {}
