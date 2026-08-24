import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { TypeOperationCaisse } from '../generated/tenant-client';
import { LicenceActiveGuard } from '../licence/licence-active.guard';
import { RequireActiveLicence } from '../licence/require-active-licence.decorator';
import { RequirePermission } from '../permissions/permission.decorator';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CashService } from './cash.service';
import { CreateCashOperationDto } from './dto/create-cash-operation.dto';

// ADMIN + CAISSIER uniquement (cahier des charges §2.1 : le CAISSIER
// "effectue les operations de caisse autorisees", l'ADMIN "supervise la
// caisse"). TECHNICIEN/LIVREUR n'ont aucun accès à la caisse.
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, LicenceActiveGuard)
@Roles(Role.ADMIN, Role.CAISSIER)
@Controller('caisse')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  // Pas de @RequirePermission ici volontairement (021-permissions-granulaires,
  // même limite que OrdersController#updateStatut) : un seul endpoint sert
  // les 5 permissions caisse.* selon dto.type, @RequirePermission ne gère
  // qu'une permission unique par route — décision différée.
  @RequireActiveLicence()
  @Post('operations')
  enregistrer(@CurrentTenant() context: AuthenticatedContext, @Body() dto: CreateCashOperationDto) {
    this.requireTenant(context);
    return this.cashService.enregistrer(context.tenantId as string, context.userId, dto);
  }

  @RequirePermission('caisse.read')
  @Get('operations')
  journal(
    @CurrentTenant() context: AuthenticatedContext,
    @Query('type') type?: TypeOperationCaisse,
  ) {
    this.requireTenant(context);
    return this.cashService.journal(context.tenantId as string, type);
  }

  @RequirePermission('caisse.read')
  @Get('solde')
  async solde(@CurrentTenant() context: AuthenticatedContext) {
    this.requireTenant(context);
    const solde = await this.cashService.solde(context.tenantId as string);
    return { solde: solde.toString() };
  }

  private requireTenant(context: AuthenticatedContext): void {
    if (!context.tenantId) {
      throw new ForbiddenException();
    }
  }
}
