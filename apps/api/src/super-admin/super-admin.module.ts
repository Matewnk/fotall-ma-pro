import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BusinessContactRequestsModule } from '../business-contact-requests/business-contact-requests.module';
import { SupportTicketsModule } from '../support-tickets/support-tickets.module';
import { UsersModule } from '../users/users.module';
import { SuperAdminBusinessRequestsController } from './business-requests.controller';
import { PlanDefinitionsController } from './plan-definitions.controller';
import { PlatformAuditController } from './platform-audit.controller';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { SuperAdminSupportTicketsController } from './support-tickets.controller';
import { SupportSessionController } from './support-session.controller';
import { SupportSessionGuard } from './support-session.guard';
import { SupportSessionService } from './support-session.service';
import { TenantsController } from './tenants.controller';
import { SuperAdminUsersController } from './users.controller';

@Module({
  imports: [AuditModule, SupportTicketsModule, UsersModule, BusinessContactRequestsModule],
  controllers: [
    TenantsController,
    StatsController,
    SupportSessionController,
    SuperAdminUsersController,
    PlatformAuditController,
    PlanDefinitionsController,
    SuperAdminSupportTicketsController,
    SuperAdminBusinessRequestsController,
  ],
  providers: [SupportSessionService, SupportSessionGuard, StatsService],
})
export class SuperAdminModule {}
