import { Module } from '@nestjs/common';
import { BusinessContactRequestsController } from './business-contact-requests.controller';
import { BusinessContactRequestsService } from './business-contact-requests.service';

@Module({
  controllers: [BusinessContactRequestsController],
  providers: [BusinessContactRequestsService],
  exports: [BusinessContactRequestsService],
})
export class BusinessContactRequestsModule {}
