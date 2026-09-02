import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PrioriteTicketSupport, Role, StatutTicketSupport } from '@prisma/client';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { CreateSupportTicketMessageDto } from '../support-tickets/dto/create-support-ticket-message.dto';
import { SupportTicketsService } from '../support-tickets/support-tickets.service';
import { UpdateSupportTicketStatutDto } from './dto/update-support-ticket-statut.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin/support-tickets')
export class SuperAdminSupportTicketsController {
  constructor(private readonly supportTicketsService: SupportTicketsService) {}

  @Get()
  liste(
    @Query('tenantId') tenantId?: string,
    @Query('statut') statut?: StatutTicketSupport,
    @Query('priorite') priorite?: PrioriteTicketSupport,
    @Query('depuis') depuis?: string,
  ) {
    return this.supportTicketsService.listeGlobale({
      tenantId,
      statut,
      priorite,
      ...(depuis ? { depuis: new Date(depuis) } : {}),
    });
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.supportTicketsService.detailGlobal(id);
  }

  @Patch(':id/statut')
  changerStatut(@Param('id') id: string, @Body() dto: UpdateSupportTicketStatutDto) {
    return this.supportTicketsService.changerStatut(id, dto.statut);
  }

  @Post(':id/messages')
  ajouterMessage(
    @CurrentTenant() actor: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: CreateSupportTicketMessageDto,
  ) {
    return this.supportTicketsService.ajouterMessageSuperAdmin(id, actor.userId, dto);
  }
}
