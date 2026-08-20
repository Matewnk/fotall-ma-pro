import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { OrdersModule } from '../orders/orders.module';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeyService } from './api-key.service';
import { ApiKeysController } from './api-keys.controller';
import { PublicApiController } from './public-api.controller';

@Module({
  imports: [ClientsModule, OrdersModule],
  controllers: [ApiKeysController, PublicApiController],
  providers: [ApiKeyService, ApiKeyGuard],
})
export class OpenApiModule {}
