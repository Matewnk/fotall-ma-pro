import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { CreateSupportTicketMessageDto } from './dto/create-support-ticket-message.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { SupportTicketsService } from './support-tickets.service';

// Ouvert à tout le personnel du tenant (pas seulement ADMIN) : demander de
// l'aide n'est pas une action administrative, contrairement aux autres
// écritures de ce module — cf. clients.controller.ts, réservé ADMIN/CAISSIER
// par le cahier des charges. Jamais bloqué par LicenceActiveGuard : un
// tenant en panne de licence doit pouvoir contacter le support.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.CAISSIER, Role.TECHNICIEN, Role.LIVREUR)
@Controller('support-tickets')
export class SupportTicketsController {
  constructor(private readonly supportTicketsService: SupportTicketsService) {}

  @Post()
  create(@CurrentTenant() context: AuthenticatedContext, @Body() dto: CreateSupportTicketDto) {
    this.requireTenant(context);
    return this.supportTicketsService.create(context.tenantId as string, context.userId, dto);
  }

  @Get()
  list(@CurrentTenant() context: AuthenticatedContext) {
    this.requireTenant(context);
    return this.supportTicketsService.listPourTenant(context.tenantId as string);
  }

  @Get(':id')
  detail(@CurrentTenant() context: AuthenticatedContext, @Param('id') id: string) {
    this.requireTenant(context);
    return this.supportTicketsService.detailPourTenant(context.tenantId as string, id);
  }

  @Post(':id/messages')
  ajouterMessage(
    @CurrentTenant() context: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: CreateSupportTicketMessageDto,
  ) {
    this.requireTenant(context);
    return this.supportTicketsService.ajouterMessagePourTenant(
      context.tenantId as string,
      id,
      context.userId,
      dto,
    );
  }

  private requireTenant(context: AuthenticatedContext): void {
    if (!context.tenantId) {
      throw new ForbiddenException();
    }
  }
}
