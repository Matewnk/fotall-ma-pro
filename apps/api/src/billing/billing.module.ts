import { Module } from '@nestjs/common';
import { LicenceModule } from '../licence/licence.module';
import { BillingController } from './billing.controller';
import { BillingScheduler } from './billing.scheduler';
import { BillingService } from './billing.service';
import { BillingWebhookController } from './billing-webhook.controller';
import { WebhookSecretGuard } from './webhook-secret.guard';

@Module({
  imports: [LicenceModule],
  controllers: [BillingController, BillingWebhookController],
  providers: [BillingService, BillingScheduler, WebhookSecretGuard],
  exports: [BillingService],
})
export class BillingModule {}
