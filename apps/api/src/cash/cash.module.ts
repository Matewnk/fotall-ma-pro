import { Module } from '@nestjs/common';
import { LicenceModule } from '../licence/licence.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';

@Module({
  imports: [LicenceModule, PermissionsModule],
  controllers: [CashController],
  providers: [CashService],
})
export class CashModule {}
