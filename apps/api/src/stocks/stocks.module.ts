import { Module } from '@nestjs/common';
import { LicenceModule } from '../licence/licence.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { StocksController } from './stocks.controller';
import { StocksService } from './stocks.service';

@Module({
  imports: [LicenceModule, PermissionsModule],
  controllers: [StocksController],
  providers: [StocksService],
})
export class StocksModule {}
