import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlanCommercial, Role, StatutLicence } from '@prisma/client';
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

  // §022 : recherche (nom/sous-domaine) et filtres (statut licence, plan)
  // en base plutôt que côté client — la liste grossit avec le nombre de
  // tenants. "Propriétaire" = premier ADMIN créé pour ce tenant (aucun
  // champ "owner" dédié dans le modèle User ; le premier ADMIN est celui
  // créé par /auth/register, cf. auth.service.ts). "Nombre d'utilisateurs"
  // = compte réel. Pas de "dernière activité" : aucune donnée de dernière
  // connexion n'existe aujourd'hui (User n'a pas de lastLoginAt) — l'ajouter
  // demanderait une migration + une écriture à chaque connexion, hors
  // périmètre de cette passe (voir specs/022-super-admin-enhancement).
  @Get()
  async list(
    @Query('q') q?: string,
    @Query('statut') statut?: StatutLicence,
    @Query('plan') plan?: string,
  ) {
    const tenants = await this.prisma.tenant.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { nomPressing: { contains: q, mode: 'insensitive' } },
                { sousDomaine: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(plan && Object.values(PlanCommercial).includes(plan as PlanCommercial)
          ? { plan: plan as PlanCommercial }
          : {}),
        ...(statut ? { licence: { statut } } : {}),
      },
      select: {
        id: true,
        nomPressing: true,
        sousDomaine: true,
        plan: true,
        createdAt: true,
        licence: { select: { statut: true, dateFinEssai: true, dateExpirationCourante: true } },
        users: {
          where: { role: Role.ADMIN },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { email: true },
        },
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants.map(({ users, _count, ...tenant }) => ({
      ...tenant,
      proprietaire: users[0]?.email ?? null,
      nombreUtilisateurs: _count.users,
    }));
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
        users: {
          where: { role: Role.ADMIN },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { email: true },
        },
        _count: { select: { users: true } },
      },
    });
    if (!tenant) {
      throw new NotFoundException();
    }
    const { users, _count, ...reste } = tenant;
    return {
      ...reste,
      proprietaire: users[0]?.email ?? null,
      nombreUtilisateurs: _count.users,
    };
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
