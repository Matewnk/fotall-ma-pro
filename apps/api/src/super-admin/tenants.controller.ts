import { Body, Controller, Get, NotFoundException, Param, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTenantPlanDto } from './dto/update-tenant-plan.dto';

// Donnees control-plane uniquement (nom, sous-domaine, plan, statut de
// licence) : jamais les donnees metier detaillees d'un tenant, qui
// exigent le mode support explicite (support-session.controller.ts).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin/tenants')
export class TenantsController {
  constructor(private readonly prisma: PrismaService) {}

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

  @Patch(':id/plan')
  updatePlan(@Param('id') id: string, @Body() dto: UpdateTenantPlanDto) {
    return this.prisma.tenant.update({ where: { id }, data: { plan: dto.plan } });
  }
}
