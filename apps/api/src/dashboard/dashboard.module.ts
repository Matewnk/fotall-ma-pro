import { Module } from '@nestjs/common';
import { LicenceModule } from '../licence/licence.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [LicenceModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
