import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuteurMessageTicket, PrioriteTicketSupport, StatutTicketSupport } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupportTicketMessageDto } from './dto/create-support-ticket-message.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';

const INCLUDE_MESSAGES = { messages: { orderBy: { createdAt: 'asc' as const } } };

@Injectable()
export class SupportTicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, auteurId: string, dto: CreateSupportTicketDto) {
    return this.prisma.supportTicket.create({
      data: {
        tenantId,
        auteurId,
        sujet: dto.sujet,
        description: dto.description,
        ...(dto.priorite ? { priorite: dto.priorite } : {}),
      },
    });
  }

  async listPourTenant(tenantId: string) {
    return this.prisma.supportTicket.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async detailPourTenant(tenantId: string, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: INCLUDE_MESSAGES,
    });
    // Un tenant qui devine l'id d'un ticket d'un autre tenant reçoit un 404
    // identique à "n'existe pas" — jamais de 403 qui confirmerait l'existence.
    if (!ticket || ticket.tenantId !== tenantId) {
      throw new NotFoundException();
    }
    return ticket;
  }

  async ajouterMessagePourTenant(
    tenantId: string,
    ticketId: string,
    auteurId: string,
    dto: CreateSupportTicketMessageDto,
  ) {
    await this.detailPourTenant(tenantId, ticketId);
    return this.prisma.supportTicketMessage.create({
      data: {
        ticketId,
        auteurId,
        auteurType: AuteurMessageTicket.TENANT,
        corps: dto.corps,
      },
    });
  }

  // §022-super-admin-enhancement : vue plateforme, control-plane uniquement
  // (SupportTicket vit hors du schéma tenant) — le SUPER_ADMIN voit et
  // répond à tous les tickets sans passer par le mode support (motivé pour
  // les données métier d'un tenant), puisqu'un ticket est déjà une demande
  // explicite adressée à la plateforme, pas une donnée métier privée.
  async listeGlobale(filtres: {
    tenantId?: string | undefined;
    statut?: StatutTicketSupport | undefined;
    priorite?: PrioriteTicketSupport | undefined;
    depuis?: Date | undefined;
  }) {
    return this.prisma.supportTicket.findMany({
      where: {
        ...(filtres.tenantId ? { tenantId: filtres.tenantId } : {}),
        ...(filtres.statut ? { statut: filtres.statut } : {}),
        ...(filtres.priorite ? { priorite: filtres.priorite } : {}),
        ...(filtres.depuis ? { createdAt: { gte: filtres.depuis } } : {}),
      },
      include: { tenant: { select: { nomPressing: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async detailGlobal(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { ...INCLUDE_MESSAGES, tenant: { select: { nomPressing: true } } },
    });
    if (!ticket) {
      throw new NotFoundException();
    }
    return ticket;
  }

  async changerStatut(ticketId: string, statut: StatutTicketSupport) {
    const existant = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!existant) {
      throw new NotFoundException();
    }
    if (existant.statut === StatutTicketSupport.RESOLU && statut !== StatutTicketSupport.RESOLU) {
      // Un ticket résolu ne se ré-ouvre pas silencieusement en changeant
      // juste le statut : ça exigerait un nouveau message expliquant
      // pourquoi, pas seulement un clic. Cohérent avec "jamais de régression
      // silencieuse d'état" déjà appliqué aux statuts de commande.
      throw new ForbiddenException('Un ticket résolu ne peut pas être rouvert directement.');
    }
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        statut,
        ...(statut === StatutTicketSupport.RESOLU ? { resoluAt: new Date() } : {}),
      },
    });
  }

  async ajouterMessageSuperAdmin(
    ticketId: string,
    superAdminId: string,
    dto: CreateSupportTicketMessageDto,
  ) {
    await this.detailGlobal(ticketId);
    return this.prisma.supportTicketMessage.create({
      data: {
        ticketId,
        auteurId: superAdminId,
        auteurType: AuteurMessageTicket.SUPER_ADMIN,
        corps: dto.corps,
      },
    });
  }
}
