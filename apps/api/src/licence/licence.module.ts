import { Module } from '@nestjs/common';
import { JwtConfigModule } from '../common/jwt-config.module';
import { LicenceActiveGuard } from './licence-active.guard';
import { LicenceController } from './licence.controller';
import { LicenceScheduler } from './licence.scheduler';
import { LicenceService } from './licence.service';
import { SuperAdminLicenceController } from './super-admin-licence.controller';

// L'evenement licence.essai.bientot_expire est consomme par
// NotificationsEventsListener (012) : ce module ne connait aucun
// fournisseur de notification, seulement EventEmitter2.
@Module({
  imports: [JwtConfigModule],
  controllers: [LicenceController, SuperAdminLicenceController],
  providers: [LicenceService, LicenceActiveGuard, LicenceScheduler],
  exports: [LicenceService, LicenceActiveGuard],
})
export class LicenceModule {}
