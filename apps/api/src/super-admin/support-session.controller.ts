import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { StartSupportSessionDto } from './dto/start-support-session.dto';
import { SupportSessionGuard } from './support-session.guard';
import { SupportSessionService } from './support-session.service';

// Le rôle SUPER_ADMIN n'est jamais un ADMIN avec plus de droits : il n'a
// aucun accès direct aux données d'un tenant, seulement via ce mode
// support explicite, motivé et audité de bout en bout.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin/tenants/:id/support')
export class SupportSessionController {
  constructor(
    private readonly supportSessions: SupportSessionService,
    private readonly auditService: AuditService,
  ) {}

  @Get('session')
  async session(@Param('id') tenantId: string, @CurrentTenant() actor: AuthenticatedContext) {
    const active = await this.supportSessions.getActive(tenantId, actor.userId);
    return { actif: active !== null, session: active };
  }

  @Post('demarrer')
  demarrer(
    @Param('id') tenantId: string,
    @CurrentTenant() actor: AuthenticatedContext,
    @Body() dto: StartSupportSessionDto,
  ) {
    return this.supportSessions.demarrer(tenantId, actor.userId, dto.motif);
  }

  @Post('terminer')
  terminer(@Param('id') tenantId: string, @CurrentTenant() actor: AuthenticatedContext) {
    return this.supportSessions.terminer(tenantId, actor.userId);
  }

  // Accès détaillé aux données du tenant : exige une session active
  // (SupportSessionGuard). Périmètre actuel = AuditLog, seule entité
  // tenant-scoped existante ; les futures entités métier suivront le même
  // schéma d'accès Super-Admin lorsqu'elles existeront (007+).
  @UseGuards(SupportSessionGuard)
  @Get('audit')
  audit(@Param('id') tenantId: string, @Query('action') action?: string) {
    return this.auditService.list(tenantId, action);
  }
}
