import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { DashboardService } from './dashboard.service';

// Lecture seule, ouverte à tous les rôles opérationnels (cahier des charges
// §4) : ADMIN/CAISSIER pour le pilotage, TECHNICIEN/LIVREUR pour les
// alertes qui les concernent. Jamais de LicenceActiveGuard ici — un tenant
// à l'essai expiré doit encore pouvoir consulter son propre tableau de bord
// (et y voir l'alerte de licence).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.CAISSIER, Role.TECHNICIEN, Role.LIVREUR)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  obtenir(@CurrentTenant() context: AuthenticatedContext) {
    if (!context.tenantId) {
      throw new ForbiddenException();
    }
    return this.dashboardService.obtenir(context.tenantId);
  }
}
