import {
  BadRequestException,
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
import { UsersService } from '../users/users.service';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
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
    private readonly usersService: UsersService,
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
  //
  // §023-subscriptions-invoicing : quand un abonnement existe déjà, ce
  // changement de plan met aussi à jour Abonnement.plan/montant et
  // journalise l'ancien/nouveau plan+prix dans HistoriqueAbonnement —
  // jamais de prorata calculé (voir spec.md, décision explicite). Sans
  // abonnement, seul Tenant.plan change (rien à comparer).
  @Patch(':id/plan')
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdateTenantPlanDto,
    @CurrentTenant() actor: AuthenticatedContext,
  ) {
    const abonnementAvant = await this.prisma.abonnement.findUnique({ where: { tenantId: id } });

    const [tenant] = await this.prisma.$transaction([
      this.prisma.tenant.update({ where: { id }, data: { plan: dto.plan } }),
      ...(abonnementAvant
        ? [
            this.prisma.abonnement.update({
              where: { tenantId: id },
              data: {
                plan: dto.plan,
                ...(dto.nouveauMontant !== undefined ? { montant: dto.nouveauMontant } : {}),
              },
            }),
          ]
        : []),
      ...(abonnementAvant
        ? [
            this.prisma.historiqueAbonnement.create({
              data: {
                tenantId: id,
                ancienPlan: abonnementAvant.plan,
                nouveauPlan: dto.plan,
                ancienPrix: abonnementAvant.montant,
                nouveauPrix: dto.nouveauMontant ?? abonnementAvant.montant,
                devise: abonnementAvant.devise,
                effectuePar: actor.userId,
                ...(dto.motif ? { motif: dto.motif } : {}),
              },
            }),
          ]
        : []),
    ]);

    await this.auditService.create(id, actor.userId, {
      action: 'TENANT_PLAN_MODIFIE',
      entityType: 'Tenant',
      entityId: id,
      metadata: { nouveauPlan: dto.plan },
    });
    return tenant;
  }

  // Support : le SUPER_ADMIN réinitialise le mot de passe du propriétaire
  // d'un tenant qui l'a oublié (jamais de lecture/récupération de l'ancien
  // mot de passe — impossible par construction, seul le hash est stocké).
  // tenantId vient de l'URL (jamais du body) et scope la recherche du user
  // dans UsersService.resetMotDePasse (findFirst id+tenantId) : un userId
  // d'un autre tenant renvoie 404, jamais une modification silencieuse.
  // forcerChangement=true (dernier argument) : active mustChangePassword +
  // révoque les sessions déjà émises (tokenVersion), contrairement au
  // reset ADMIN existant qui garde son comportement historique.
  @Patch(':tenantId/utilisateurs/:userId/mot-de-passe')
  async reinitialiserMotDePasse(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentTenant() actor: AuthenticatedContext,
  ) {
    if (dto.motDePasse !== dto.confirmerMotDePasse) {
      throw new BadRequestException('La confirmation ne correspond pas.');
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant introuvable.');
    }
    await this.usersService.resetMotDePasse(
      tenantId,
      userId,
      actor.userId,
      { motDePasse: dto.motDePasse },
      true,
    );
    return { ok: true };
  }

  @Get(':id/historique-abonnement')
  async historiqueAbonnement(@Param('id') id: string) {
    const entrees = await this.prisma.historiqueAbonnement.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' },
    });
    return entrees.map((entree) => ({
      ...entree,
      ancienPrix: entree.ancienPrix?.toNumber() ?? null,
      nouveauPrix: entree.nouveauPrix?.toNumber() ?? null,
    }));
  }
}
