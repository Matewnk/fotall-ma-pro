import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { PlanCommercial, Role } from '@prisma/client';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlanDefinitionDto } from './dto/update-plan-definition.dto';

// §022-super-admin-enhancement — catalogue de référence des plans
// commerciaux. Un seul enregistrement PlanDefinition par valeur de
// PlanCommercial : GET le crée (vide, non configuré) au premier accès s'il
// manque, plutôt que d'exiger un seed séparé. "Nombre de tenants" est
// calculé en direct depuis Tenant.plan — jamais dupliqué dans
// PlanDefinition, qui ne porte que la référence tarifaire/limites.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin/plans')
export class PlanDefinitionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async liste() {
    const [definitions, repartition] = await Promise.all([
      this.assurerDefinitionsCompletes(),
      this.prisma.tenant.groupBy({ by: ['plan'], _count: { _all: true } }),
    ]);

    const ordrePlan = Object.values(PlanCommercial);
    return [...definitions]
      .sort((a, b) => ordrePlan.indexOf(a.plan) - ordrePlan.indexOf(b.plan))
      .map((definition) => ({
        ...definition,
        prixMensuel: definition.prixMensuel?.toNumber() ?? null,
        nombreTenants:
          repartition.find((entry) => entry.plan === definition.plan)?._count._all ?? 0,
      }));
  }

  @Put(':plan')
  async mettreAJour(
    @Param('plan') plan: PlanCommercial,
    @Body() dto: UpdatePlanDefinitionDto,
    @CurrentTenant() actor: AuthenticatedContext,
  ) {
    const definition = await this.prisma.planDefinition.upsert({
      where: { plan },
      create: { plan, ...dto, updatedBy: actor.userId },
      update: { ...dto, updatedBy: actor.userId },
    });
    return { ...definition, prixMensuel: definition.prixMensuel?.toNumber() ?? null };
  }

  private async assurerDefinitionsCompletes() {
    const existantes = await this.prisma.planDefinition.findMany();
    const plansManquants = Object.values(PlanCommercial).filter(
      (plan) => !existantes.some((definition) => definition.plan === plan),
    );
    if (plansManquants.length === 0) {
      return existantes;
    }
    await this.prisma.planDefinition.createMany({
      data: plansManquants.map((plan) => ({ plan })),
      skipDuplicates: true,
    });
    return this.prisma.planDefinition.findMany();
  }
}
