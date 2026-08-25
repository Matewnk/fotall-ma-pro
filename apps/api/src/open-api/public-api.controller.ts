import { Controller, Get, UseGuards } from '@nestjs/common';
import { ClientsService } from '../clients/clients.service';
import { OrdersService } from '../orders/orders.service';
import { ApiKeyGuard } from './api-key.guard';
import { CurrentApiKey } from './current-api-key.decorator';
import { RequireScopes } from './scopes.decorator';
import type { ContexteApiKey } from './api-key.service';

// Surface "API ouverte" (§17) exposée aux intégrations tierces via clé
// API — jamais de JWT ici. Réutilise directement les services métier
// déjà construits (007-clients, 009-orders) : même logique, même
// isolation tenant (TenantPrismaFactory), la seule différence est le
// mécanisme d'authentification.
//
// §17 liste 4 ressources (clients, commandes, paiements, rapports) ;
// seules clients et commandes sont exposées dans cette tranche —
// paiements et rapports suivent le même schéma et sont différés,
// voir specs/019-open-api/spec.md.
@UseGuards(ApiKeyGuard)
@Controller('api/v1')
export class PublicApiController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly ordersService: OrdersService,
  ) {}

  @RequireScopes('clients:read')
  @Get('clients')
  clients(@CurrentApiKey() contexte: ContexteApiKey) {
    return this.clientsService.list(contexte.tenantId);
  }

  @RequireScopes('commandes:read')
  @Get('commandes')
  commandes(@CurrentApiKey() contexte: ContexteApiKey) {
    return this.ordersService.list(contexte.tenantId);
  }
}
