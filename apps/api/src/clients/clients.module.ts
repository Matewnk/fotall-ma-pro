import { Module } from '@nestjs/common';
import { LicenceModule } from '../licence/licence.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [LicenceModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
