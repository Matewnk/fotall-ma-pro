import { Body, Controller, ForbiddenException, Get, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { TenantSettingsService } from './tenant-settings.service';

// §14/branding : identité du tenant (nom, coordonnées, logo, préférences
// régionales). ADMIN uniquement, comme users/*. Jamais de
// LicenceActiveGuard : consulter/corriger ces informations doit rester
// possible même tenant bloqué.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('tenant')
export class TenantSettingsController {
  constructor(private readonly tenantSettingsService: TenantSettingsService) {}

  @Get()
  get(@CurrentTenant() context: AuthenticatedContext) {
    return this.tenantSettingsService.get(this.requireTenant(context));
  }

  @Patch()
  update(@CurrentTenant() context: AuthenticatedContext, @Body() dto: UpdateTenantSettingsDto) {
    return this.tenantSettingsService.update(this.requireTenant(context), dto);
  }

  private requireTenant(context: AuthenticatedContext): string {
    if (!context.tenantId) {
      throw new ForbiddenException();
    }
    return context.tenantId;
  }
}
