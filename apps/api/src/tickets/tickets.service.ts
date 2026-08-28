import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';
import { buildDeliverySlipPdf } from './delivery-slip.builder';
import { buildEscPosTicket, LargeurTicketMm } from './escpos.builder';
import { buildPdfTicket } from './pdf.builder';
import { TicketData } from './ticket-data';

@Injectable()
export class TicketsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaFactory,
    private readonly prisma: PrismaService,
  ) {}

  async getTicketData(tenantId: string, commandeId: string): Promise<TicketData> {
    const [tenant, commande, encaissement] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
      this.tenantPrisma.forTenant(tenantId).commande.findUnique({
        where: { id: commandeId },
        include: { client: true, articles: { include: { service: true } } },
      }),
      this.tenantPrisma.forTenant(tenantId).operationCaisse.findFirst({
        where: { commandeId, type: 'ENCAISSEMENT' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!commande) {
      throw new NotFoundException();
    }

    return {
      numero: commande.numero,
      estProvisoire: commande.estProvisoire,
      nomPressing: tenant.nomPressing,
      adresseTenant: tenant.adresse,
      telephoneTenant: tenant.telephone,
      logoUrl: tenant.logoUrl,
      client: { nom: commande.client.nom, telephone: commande.client.telephone },
      articles: commande.articles.map((article) => ({
        intitule: article.service.intitule,
        quantite: article.quantite,
        tarifUnitaire: article.tarifUnitaire.toString(),
        sousTotal: article.sousTotal.toString(),
      })),
      sousTotal: commande.sousTotal.toString(),
      remise: commande.remise.toString(),
      total: commande.total.toString(),
      datePrevue: commande.datePrevue,
      modeLivraison: commande.modeLivraison,
      adresseLivraison: commande.adresseLivraison,
      statut: commande.statut,
      modePaiement: encaissement?.modePaiement ?? null,
    };
  }

  async genererPdf(tenantId: string, commandeId: string): Promise<Buffer> {
    const data = await this.getTicketData(tenantId, commandeId);
    return buildPdfTicket(data);
  }

  async genererEscPos(
    tenantId: string,
    commandeId: string,
    largeurMm: LargeurTicketMm,
  ): Promise<Buffer> {
    const data = await this.getTicketData(tenantId, commandeId);
    return buildEscPosTicket(data, largeurMm);
  }

  async genererBonLivraisonPdf(tenantId: string, commandeId: string): Promise<Buffer> {
    const data = await this.getTicketData(tenantId, commandeId);
    return buildDeliverySlipPdf(data);
  }
}
