import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { StatutCommande } from '../generated/tenant-client';
import { LicenceActiveGuard } from '../licence/licence-active.guard';
import { RequireActiveLicence } from '../licence/require-active-licence.decorator';
import { RequirePermission } from '../permissions/permission.decorator';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

// Lecture et mise a jour de statut ouvertes a tous les roles operationnels
// (ADMIN, CAISSIER, TECHNICIEN, LIVREUR) : chacun intervient a une etape du
// cycle (cahier des charges §2.1 — TECHNICIEN traite, LIVREUR livre). La
// creation reste reservee a ADMIN/CAISSIER (prise de commande).
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, LicenceActiveGuard)
@Controller('commandes')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Roles(Role.ADMIN, Role.CAISSIER)
  @RequirePermission('commandes.create')
  @RequireActiveLicence()
  @Post()
  create(@CurrentTenant() context: AuthenticatedContext, @Body() dto: CreateOrderDto) {
    this.requireTenant(context);
    return this.ordersService.create(context.tenantId as string, dto);
  }

  @Roles(Role.ADMIN, Role.CAISSIER, Role.TECHNICIEN, Role.LIVREUR)
  @RequirePermission('commandes.read')
  @Get()
  list(
    @CurrentTenant() context: AuthenticatedContext,
    @Query('statut') statut?: StatutCommande,
    @Query('clientId') clientId?: string,
  ) {
    this.requireTenant(context);
    return this.ordersService.list(context.tenantId as string, statut, clientId);
  }

  @Roles(Role.ADMIN, Role.CAISSIER, Role.TECHNICIEN, Role.LIVREUR)
  @RequirePermission('commandes.read')
  @Get(':id')
  findById(@CurrentTenant() context: AuthenticatedContext, @Param('id') id: string) {
    this.requireTenant(context);
    return this.ordersService.findById(context.tenantId as string, id);
  }

  // Pas de @RequirePermission ici volontairement (021-permissions-granulaires,
  // point ouvert) : un seul endpoint sert 3 permissions conceptuellement
  // distinctes de la matrice (commandes.update-statut, livraisons.update-statut,
  // traitement.update-statut) selon le rôle appelant — @RequirePermission ne
  // gère qu'une permission unique par route. Ajouter naïvement l'une des
  // trois bloquerait les rôles qui n'ont que les deux autres par défaut
  // (ex. LIVREUR n'a pas commandes.update-statut). Nécessite soit de scinder
  // la route par domaine, soit un contrôle multi-permission dans le service ;
  // décision différée, cf. specs/021-permissions-granulaires/tasks.md.
  @Roles(Role.ADMIN, Role.CAISSIER, Role.TECHNICIEN, Role.LIVREUR)
  @RequireActiveLicence()
  @Patch(':id/statut')
  updateStatut(
    @CurrentTenant() context: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    this.requireTenant(context);
    return this.ordersService.updateStatut(context.tenantId as string, id, dto);
  }

  private requireTenant(context: AuthenticatedContext): void {
    if (!context.tenantId) {
      throw new ForbiddenException();
    }
  }
}
