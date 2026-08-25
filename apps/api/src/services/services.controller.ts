import {
  Body,
  Controller,
  Delete,
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
import { LicenceActiveGuard } from '../licence/licence-active.guard';
import { RequireActiveLicence } from '../licence/require-active-licence.decorator';
import { RequirePermission } from '../permissions/permission.decorator';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

// Le tarif d'un tenant ne doit jamais apparaître dans un autre tenant
// (exigence explicite du cahier des charges) : garanti structurellement
// par TenantPrismaFactory (schéma PostgreSQL dédié), comme pour Client.
// Lecture ouverte à ADMIN et CAISSIER (besoin en caisse/commande) ; seul
// ADMIN gère le catalogue (cahier des charges §2.1 : "gérer les tarifs et
// services" est une prérogative ADMIN).
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, LicenceActiveGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // @RequirePermission s'applique en ET logique avec @Roles, jamais en
  // remplacement (021-permissions-granulaires) : le rôle filtre d'abord,
  // la permission effective (défaut du rôle + overrides ADMIN) tranche
  // ensuite.
  @Roles(Role.ADMIN)
  @RequirePermission('services.create')
  @RequireActiveLicence()
  @Post()
  create(@CurrentTenant() context: AuthenticatedContext, @Body() dto: CreateServiceDto) {
    this.requireTenant(context);
    return this.servicesService.create(context.tenantId as string, dto);
  }

  @Roles(Role.ADMIN, Role.CAISSIER)
  @RequirePermission('services.read')
  @Get()
  list(@CurrentTenant() context: AuthenticatedContext, @Query('actif') actif?: string) {
    this.requireTenant(context);
    const filtre = actif === undefined ? undefined : actif === 'true';
    return this.servicesService.list(context.tenantId as string, filtre);
  }

  @Roles(Role.ADMIN, Role.CAISSIER)
  @RequirePermission('services.read')
  @Get(':id')
  findById(@CurrentTenant() context: AuthenticatedContext, @Param('id') id: string) {
    this.requireTenant(context);
    return this.servicesService.findById(context.tenantId as string, id);
  }

  @Roles(Role.ADMIN)
  @RequirePermission('services.update')
  @RequireActiveLicence()
  @Patch(':id')
  update(
    @CurrentTenant() context: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    this.requireTenant(context);
    return this.servicesService.update(context.tenantId as string, id, dto);
  }

  @Roles(Role.ADMIN)
  @RequirePermission('services.delete')
  @RequireActiveLicence()
  @Delete(':id')
  async remove(@CurrentTenant() context: AuthenticatedContext, @Param('id') id: string) {
    this.requireTenant(context);
    await this.servicesService.remove(context.tenantId as string, id);
    return { ok: true };
  }

  private requireTenant(context: AuthenticatedContext): void {
    if (!context.tenantId) {
      throw new ForbiddenException();
    }
  }
}
