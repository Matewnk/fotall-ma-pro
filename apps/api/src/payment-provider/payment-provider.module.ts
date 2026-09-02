import { Module } from '@nestjs/common';
import { PaytechService } from './paytech.service';

@Module({
  providers: [PaytechService],
  exports: [PaytechService],
})
export class PaymentProviderModule {}
