import { Module } from '@nestjs/common';
import { LicenceModule } from '../licence/licence.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [LicenceModule, PermissionsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
