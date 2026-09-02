import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { PaymentProviderModule } from '../payment-provider/payment-provider.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { BillingSelfServiceController } from './billing-self-service.controller';

@Module({
  imports: [BillingModule, InvoicesModule, PermissionsModule, PaymentProviderModule, AuditModule],
  controllers: [BillingSelfServiceController],
})
export class BillingSelfServiceModule {}
