import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StatsController } from './stats.controller';
import { SupportSessionController } from './support-session.controller';
import { SupportSessionGuard } from './support-session.guard';
import { SupportSessionService } from './support-session.service';
import { TenantsController } from './tenants.controller';

@Module({
  imports: [AuditModule],
  controllers: [TenantsController, StatsController, SupportSessionController],
  providers: [SupportSessionService, SupportSessionGuard],
})
export class SuperAdminModule {}
