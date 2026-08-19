import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LicenceService } from './licence.service';

@Injectable()
export class LicenceScheduler {
  private readonly logger = new Logger(LicenceScheduler.name);

  constructor(private readonly licenceService: LicenceService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async traiterEcheances(): Promise<void> {
    try {
      await this.licenceService.traiterEcheancesEssai();
    } catch (error) {
      this.logger.error('Echec du job d’échéances de licence', error as Error);
    }
  }
}
