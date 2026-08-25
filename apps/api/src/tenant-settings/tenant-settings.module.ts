import { Module } from '@nestjs/common';
import { LogoStorageService } from './logo-storage.service';
import { TenantSettingsController } from './tenant-settings.controller';
import { TenantSettingsService } from './tenant-settings.service';

@Module({
  controllers: [TenantSettingsController],
  providers: [TenantSettingsService, LogoStorageService],
})
export class TenantSettingsModule {}
