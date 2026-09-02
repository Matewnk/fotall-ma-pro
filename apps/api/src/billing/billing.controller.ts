import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role, StatutAbonnement } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BillingService } from './billing.service';
import { CreateAbonnementDto } from './dto/create-abonnement.dto';

// §13.6/§14.1 : la facturation reste sous le contrôle exclusif du
// SUPER_ADMIN en V1 — un tenant ne modifie jamais directement l'état de
// sa licence ou de son abonnement.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin/facturation')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // Déclarée avant ':tenantId' uniquement par lisibilité — Nest/Express
  // distingue déjà les deux routes par leur nombre de segments, aucune
  // collision possible.
  @Get()
  liste(
    @Query('tenantId') tenantId?: string,
    @Query('statut') statut?: StatutAbonnement,
    @Query('plan') plan?: string,
  ) {
    return this.billingService.listerFacturationGlobale({ tenantId, statut, plan });
  }

  @Get(':tenantId')
  obtenir(@Param('tenantId') tenantId: string) {
    return this.billingService.obtenirFacturation(tenantId);
  }

  @Post(':tenantId/abonnement')
  creer(@Param('tenantId') tenantId: string, @Body() dto: CreateAbonnementDto) {
    return this.billingService.creerAbonnement(tenantId, dto);
  }
}
