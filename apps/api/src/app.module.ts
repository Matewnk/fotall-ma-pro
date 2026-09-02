import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BackupModule } from './backup/backup.module';
import { BillingModule } from './billing/billing.module';
import { BillingSelfServiceModule } from './billing-self-service/billing-self-service.module';
import { CashModule } from './cash/cash.module';
import { ClientsModule } from './clients/clients.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InvoicesModule } from './invoices/invoices.module';
import { LicenceModule } from './licence/licence.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { OpenApiModule } from './open-api/open-api.module';
import { OrdersModule } from './orders/orders.module';
import { PermissionsModule } from './permissions/permissions.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicTrackingModule } from './public-tracking/public-tracking.module';
import { ReportsModule } from './reports/reports.module';
import { ServicesModule } from './services/services.module';
import { StocksModule } from './stocks/stocks.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { TenantSettingsModule } from './tenant-settings/tenant-settings.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    PrismaModule,
    TenancyModule,
    LicenceModule,
    PermissionsModule,
    ServicesModule,
    NotificationsModule,
    OnboardingModule,
    AuthModule,
    AuditModule,
    SuperAdminModule,
    ClientsModule,
    OrdersModule,
    CashModule,
    TicketsModule,
    DashboardModule,
    ReportsModule,
    StocksModule,
    BillingModule,
    OpenApiModule,
    BackupModule,
    UsersModule,
    TenantSettingsModule,
    PublicTrackingModule,
    InvoicesModule,
    BillingSelfServiceModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
