import { Body, Controller, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { BackupService } from './backup.service';
import { RestoreTenantDto } from './dto/restore-tenant.dto';

// Interface structurelle minimale (voir tickets.controller.ts, 011) :
// évite une dépendance à @types/express pour prendre le contrôle complet
// de la réponse (nécessaire pour envoyer le dump SQL en octets bruts).
type ReponseBrute = {
  set: (field: string, value: string) => ReponseBrute;
  send: (corps: Buffer) => void;
};

// §15.8 / §13.6 : sauvegarde et restauration tenant par tenant, réservées
// au SUPER_ADMIN (même prérogative que la gestion des tenants). Chaque
// opération est auditée dans l'AuditLog du tenant concerné (§19.4
// "actions administratives"), même schéma que TenantsController.updatePlan
// (018).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin/tenants/:id')
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly auditService: AuditService,
  ) {}

  @Post('backup')
  async sauvegarder(
    @Param('id') tenantId: string,
    @CurrentTenant() actor: AuthenticatedContext,
    @Res() res: ReponseBrute,
  ) {
    const dump = await this.backupService.sauvegarderTenant(tenantId);
    await this.auditService.create(tenantId, actor.userId, {
      action: 'TENANT_SAUVEGARDE',
      entityType: 'Tenant',
      entityId: tenantId,
      metadata: { tailleOctets: dump.length },
    });
    res
      .set('Content-Type', 'application/sql')
      .set('Content-Disposition', `attachment; filename="tenant-${tenantId}.sql"`)
      .send(dump);
  }

  @Post('restore')
  async restaurer(
    @Param('id') tenantId: string,
    @CurrentTenant() actor: AuthenticatedContext,
    @Body() dto: RestoreTenantDto,
  ) {
    const dump = Buffer.from(dto.dumpBase64, 'base64');
    await this.backupService.restaurerTenant(tenantId, dump);
    await this.auditService.create(tenantId, actor.userId, {
      action: 'TENANT_RESTAURE',
      entityType: 'Tenant',
      entityId: tenantId,
      metadata: { tailleOctets: dump.length },
    });
    return { ok: true };
  }
}
