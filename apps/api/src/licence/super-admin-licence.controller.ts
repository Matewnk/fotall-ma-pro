import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { ActivateLicenceDto } from './dto/activate-licence.dto';
import { ReactivateLicenceDto } from './dto/reactivate-licence.dto';
import { RenewLicenceDto } from './dto/renew-licence.dto';
import { RevokeLicenceDto } from './dto/revoke-licence.dto';
import { SuspendLicenceDto } from './dto/suspend-licence.dto';
import { LicenceService } from './licence.service';

// ADMIN tenant -> 403 (RolesGuard, role SUPER_ADMIN uniquement). Distinct
// des routes tenant-scoped : jamais un "super ADMIN" avec plus de droits.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin/tenants/:id/licence')
export class SuperAdminLicenceController {
  constructor(private readonly licenceService: LicenceService) {}

  @Post('activer')
  activer(
    @Param('id') tenantId: string,
    @CurrentTenant() actor: AuthenticatedContext,
    @Body() dto: ActivateLicenceDto,
  ) {
    return this.licenceService.activer(tenantId, actor.userId, dto.idempotencyKey, dto.motif);
  }

  @Post('renouveler')
  renouveler(
    @Param('id') tenantId: string,
    @CurrentTenant() actor: AuthenticatedContext,
    @Body() dto: RenewLicenceDto,
  ) {
    return this.licenceService.renouveler(
      tenantId,
      actor.userId,
      dto.idempotencyKey,
      dto.dureeJours,
      dto.motif,
    );
  }

  @Post('suspendre')
  suspendre(
    @Param('id') tenantId: string,
    @CurrentTenant() actor: AuthenticatedContext,
    @Body() dto: SuspendLicenceDto,
  ) {
    return this.licenceService.suspendre(tenantId, actor.userId, dto.idempotencyKey, dto.motif);
  }

  @Post('reactiver')
  reactiver(
    @Param('id') tenantId: string,
    @CurrentTenant() actor: AuthenticatedContext,
    @Body() dto: ReactivateLicenceDto,
  ) {
    return this.licenceService.reactiver(tenantId, actor.userId, dto.idempotencyKey, dto.motif);
  }

  @Post('revoquer')
  revoquer(
    @Param('id') tenantId: string,
    @CurrentTenant() actor: AuthenticatedContext,
    @Body() dto: RevokeLicenceDto,
  ) {
    return this.licenceService.revoquer(tenantId, actor.userId, dto.idempotencyKey, dto.motif);
  }
}
