import { Module } from '@nestjs/common';
import { LicenceModule } from '../licence/licence.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [LicenceModule, PermissionsModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
