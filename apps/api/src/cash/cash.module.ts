import { Module } from '@nestjs/common';
import { LicenceModule } from '../licence/licence.module';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';

@Module({
  imports: [LicenceModule],
  controllers: [CashController],
  providers: [CashService],
})
export class CashModule {}
