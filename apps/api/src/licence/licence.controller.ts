import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedContext } from '../auth/types';
import { LicenceService } from './licence.service';

@UseGuards(JwtAuthGuard)
@Controller('licence')
export class LicenceController {
  constructor(private readonly licenceService: LicenceService) {}

  @Get('statut')
  async statut(@CurrentTenant() context: AuthenticatedContext) {
    if (!context.tenantId) {
      throw new ForbiddenException();
    }
    return this.licenceService.getStatut(context.tenantId);
  }
}
