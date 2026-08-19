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
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

// Le tarif d'un tenant ne doit jamais apparaître dans un autre tenant
// (exigence explicite du cahier des charges) : garanti structurellement
// par TenantPrismaFactory (schéma PostgreSQL dédié), comme pour Client.
// Lecture ouverte à ADMIN et CAISSIER (besoin en caisse/commande) ; seul
// ADMIN gère le catalogue (cahier des charges §2.1 : "gérer les tarifs et
// services" est une prérogative ADMIN).
@UseGuards(JwtAuthGuard, RolesGuard, LicenceActiveGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Roles(Role.ADMIN)
  @RequireActiveLicence()
  @Post()
  create(@CurrentTenant() context: AuthenticatedContext, @Body() dto: CreateServiceDto) {
    this.requireTenant(context);
    return this.servicesService.create(context.tenantId as string, dto);
  }

  @Roles(Role.ADMIN, Role.CAISSIER)
  @Get()
  list(@CurrentTenant() context: AuthenticatedContext, @Query('actif') actif?: string) {
    this.requireTenant(context);
    const filtre = actif === undefined ? undefined : actif === 'true';
    return this.servicesService.list(context.tenantId as string, filtre);
  }

  @Roles(Role.ADMIN, Role.CAISSIER)
  @Get(':id')
  findById(@CurrentTenant() context: AuthenticatedContext, @Param('id') id: string) {
    this.requireTenant(context);
    return this.servicesService.findById(context.tenantId as string, id);
  }

  @Roles(Role.ADMIN)
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
