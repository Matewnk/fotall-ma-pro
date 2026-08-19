import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CashModule } from './cash/cash.module';
import { ClientsModule } from './clients/clients.module';
import { LicenceModule } from './licence/licence.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ServicesModule } from './services/services.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { TicketsModule } from './tickets/tickets.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    PrismaModule,
    TenancyModule,
    LicenceModule,
    ServicesModule,
    OnboardingModule,
    AuthModule,
    AuditModule,
    SuperAdminModule,
    ClientsModule,
    OrdersModule,
    CashModule,
    TicketsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
