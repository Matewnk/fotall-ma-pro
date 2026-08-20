import { Body, Controller, Get, NotFoundException, Param, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTenantPlanDto } from './dto/update-tenant-plan.dto';

// Donnees control-plane uniquement (nom, sous-domaine, plan, statut de
// licence) : jamais les donnees metier detaillees d'un tenant, qui
// exigent le mode support explicite (support-session.controller.ts).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin/tenants')
export class TenantsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  list() {
    return this.prisma.tenant.findMany({
      select: {
        id: true,
        nomPressing: true,
        sousDomaine: true,
        plan: true,
        createdAt: true,
        licence: { select: { statut: true, dateFinEssai: true, dateExpirationCourante: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        nomPressing: true,
        sousDomaine: true,
        plan: true,
        langue: true,
        devise: true,
        fuseauHoraire: true,
        createdAt: true,
        licence: true,
      },
    });
    if (!tenant) {
      throw new NotFoundException();
    }
    return tenant;
  }

  // §19.4 : "changements de configuration" et "actions administratives"
  // sont explicitement soumis à audit. Journalisé dans l'AuditLog du
  // tenant concerné (et non une table control-plane) : c'est une
  // modification qui affecte ce tenant, cohérent avec la lecture déjà
  // exposée en mode support (SupportSessionController.audit).
  @Patch(':id/plan')
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdateTenantPlanDto,
    @CurrentTenant() actor: AuthenticatedContext,
  ) {
    const tenant = await this.prisma.tenant.update({ where: { id }, data: { plan: dto.plan } });
    await this.auditService.create(id, actor.userId, {
      action: 'TENANT_PLAN_MODIFIE',
      entityType: 'Tenant',
      entityId: id,
      metadata: { nouveauPlan: dto.plan },
    });
    return tenant;
  }
}
