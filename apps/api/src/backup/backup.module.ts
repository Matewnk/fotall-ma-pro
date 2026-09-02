import { Module } from '@nestjs/common';
import { BackupStorageService } from './backup-storage.service';
import { BackupController } from './backup.controller';
import { BackupScheduler } from './backup.scheduler';
import { BackupService } from './backup.service';

@Module({
  controllers: [BackupController],
  providers: [BackupService, BackupStorageService, BackupScheduler],
})
export class BackupModule {}
