import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role, StatutLicence } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin/stats')
export class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async global() {
    const [totalTenants, parStatut] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.licence.groupBy({ by: ['statut'], _count: { _all: true } }),
    ]);

    const repartitionLicences = Object.fromEntries(
      Object.values(StatutLicence).map((statut) => [
        statut,
        parStatut.find((entry) => entry.statut === statut)?._count._all ?? 0,
      ]),
    );

    return { totalTenants, repartitionLicences };
  }
}
