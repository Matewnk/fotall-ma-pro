import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [PermissionsModule],
  controllers: [TicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
