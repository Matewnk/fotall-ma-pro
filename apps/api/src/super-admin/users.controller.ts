import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

// §022-super-admin-enhancement : vue globale cross-tenant en LECTURE SEULE.
// Aucun nouveau droit métier — le SUPER_ADMIN ne peut ni créer, ni modifier,
// ni supprimer un utilisateur d'un tenant (ça reste le rôle d'ADMIN, cf.
// users.controller.ts tenant-scoped). Pas de "dernière connexion" : voir
// tenants.controller.ts, même limitation (aucun lastLoginAt en base).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin/utilisateurs')
export class SuperAdminUsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Query('tenantId') tenantId?: string, @Query('role') role?: Role, @Query('q') q?: string) {
    return this.prisma.user.findMany({
      where: {
        tenantId: { not: null },
        ...(tenantId ? { tenantId } : {}),
        ...(role ? { role } : {}),
        ...(q ? { email: { contains: q, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true,
        email: true,
        role: true,
        actif: true,
        createdAt: true,
        tenant: { select: { id: true, nomPressing: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
