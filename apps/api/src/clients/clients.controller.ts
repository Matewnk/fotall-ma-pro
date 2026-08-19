import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
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
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

// Premiere ecriture metier reelle : premier usage concret de
// LicenceActiveGuard (construit en 004, jamais branche jusqu'ici faute
// d'ecriture metier existante). ADMIN et CAISSIER uniquement — ce sont les
// deux roles explicitement lies a la gestion des clients dans le cahier
// des charges §2.1.
@UseGuards(JwtAuthGuard, RolesGuard, LicenceActiveGuard)
@Roles(Role.ADMIN, Role.CAISSIER)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @RequireActiveLicence()
  @Post()
  create(@CurrentTenant() context: AuthenticatedContext, @Body() dto: CreateClientDto) {
    this.requireTenant(context);
    return this.clientsService.create(context.tenantId as string, dto);
  }

  @Get()
  list(
    @CurrentTenant() context: AuthenticatedContext,
    @Query('nom') nom?: string,
    @Query('telephone') telephone?: string,
  ) {
    this.requireTenant(context);
    return this.clientsService.list(context.tenantId as string, nom, telephone);
  }

  // Lecture : jamais bloquee par LicenceActiveGuard (cahier des charges
  // §13.4 — les exports/lectures restent disponibles en etat bloque).
  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="clients.csv"')
  async exportCsv(@CurrentTenant() context: AuthenticatedContext) {
    this.requireTenant(context);
    return this.clientsService.exportCsv(context.tenantId as string);
  }

  @Get(':id')
  findById(@CurrentTenant() context: AuthenticatedContext, @Param('id') id: string) {
    this.requireTenant(context);
    return this.clientsService.findById(context.tenantId as string, id);
  }

  @RequireActiveLicence()
  @Patch(':id')
  update(
    @CurrentTenant() context: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    this.requireTenant(context);
    return this.clientsService.update(context.tenantId as string, id, dto);
  }

  @RequireActiveLicence()
  @Delete(':id')
  async remove(@CurrentTenant() context: AuthenticatedContext, @Param('id') id: string) {
    this.requireTenant(context);
    await this.clientsService.remove(context.tenantId as string, id);
    return { ok: true };
  }

  private requireTenant(context: AuthenticatedContext): void {
    if (!context.tenantId) {
      throw new ForbiddenException();
    }
  }
}
