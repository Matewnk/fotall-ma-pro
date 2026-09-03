import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Role, StatutDemandeBusiness } from '@prisma/client';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { BusinessContactRequestsService } from '../business-contact-requests/business-contact-requests.service';
import { UpdateBusinessContactRequestStatutDto } from './dto/update-business-contact-request-statut.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin/demandes-business')
export class SuperAdminBusinessRequestsController {
  constructor(private readonly businessContactRequestsService: BusinessContactRequestsService) {}

  @Get()
  liste(@Query('statut') statut?: StatutDemandeBusiness) {
    return this.businessContactRequestsService.listeGlobale({ statut });
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.businessContactRequestsService.detailGlobal(id);
  }

  @Patch(':id/statut')
  changerStatut(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessContactRequestStatutDto,
    @CurrentTenant() actor: AuthenticatedContext,
  ) {
    return this.businessContactRequestsService.changerStatut(id, actor.userId, dto.statut);
  }
}
