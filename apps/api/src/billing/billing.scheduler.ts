import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingService } from './billing.service';

@Injectable()
export class BillingScheduler {
  private readonly logger = new Logger(BillingScheduler.name);

  constructor(private readonly billingService: BillingService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async relancerAbonnements(): Promise<void> {
    try {
      await this.billingService.relancerAbonnementsEnRetard();
    } catch (error) {
      this.logger.error('Echec du job de relance de facturation', error as Error);
    }
  }
}
