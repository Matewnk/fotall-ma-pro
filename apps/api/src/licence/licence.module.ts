import { Module } from '@nestjs/common';
import { JwtConfigModule } from '../common/jwt-config.module';
import { LicenceEventsListener } from './licence-events.listener';
import { LicenceActiveGuard } from './licence-active.guard';
import { LicenceController } from './licence.controller';
import { LicenceScheduler } from './licence.scheduler';
import { LicenceService } from './licence.service';
import { SuperAdminLicenceController } from './super-admin-licence.controller';

@Module({
  imports: [JwtConfigModule],
  controllers: [LicenceController, SuperAdminLicenceController],
  providers: [LicenceService, LicenceActiveGuard, LicenceScheduler, LicenceEventsListener],
  exports: [LicenceService, LicenceActiveGuard],
})
export class LicenceModule {}
