import { Module } from '@nestjs/common';
import { LicenceModule } from '../licence/licence.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [LicenceModule, PermissionsModule],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
