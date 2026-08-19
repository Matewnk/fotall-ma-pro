import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ModeLivraison, Prisma, StatutCommande } from '../generated/tenant-client';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { estProgression } from './orders.constants';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly tenantPrisma: TenantPrismaFactory) {}

  async create(tenantId: string, dto: CreateOrderDto) {
    const client = this.tenantPrisma.forTenant(tenantId);

    const existante = await client.commande.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existante) {
      this.logger.log(`Rejeu idempotent ignoré : commande / ${dto.idempotencyKey}`);
      return client.commande.findUniqueOrThrow({
        where: { id: existante.id },
        include: { articles: true },
      });
    }

    if (dto.modeLivraison === ModeLivraison.LIVRAISON && !dto.adresseLivraison) {
      throw new BadRequestException(
        'adresseLivraison est requise quand modeLivraison = LIVRAISON.',
      );
    }

    const clientExiste = await client.client.findUnique({ where: { id: dto.clientId } });
    if (!clientExiste) {
      throw new NotFoundException('Client introuvable.');
    }

    // Tarifs toujours lus depuis le catalogue au moment de la commande,
    // jamais fournis par l'appelant — calcul serveur (cahier des charges §6.2).
    const serviceIds = dto.articles.map((article) => article.serviceId);
    const services = await client.service.findMany({ where: { id: { in: serviceIds } } });
    if (services.length !== new Set(serviceIds).size) {
      throw new NotFoundException('Un ou plusieurs services sont introuvables.');
    }
    const servicesParId = new Map(services.map((service) => [service.id, service]));

    const articles = dto.articles.map((article) => {
      const service = servicesParId.get(article.serviceId);
      if (!service) {
        throw new NotFoundException(`Service ${article.serviceId} introuvable.`);
      }
      const tarifUnitaire = service.tarif;
      const sousTotal = tarifUnitaire.mul(article.quantite);
      return { serviceId: article.serviceId, quantite: article.quantite, tarifUnitaire, sousTotal };
    });

    const sousTotal = articles.reduce(
      (acc, article) => acc.add(article.sousTotal),
      new Prisma.Decimal(0),
    );
    const remise = new Prisma.Decimal(dto.remise ?? 0);
    if (remise.greaterThan(sousTotal)) {
      throw new BadRequestException('La remise ne peut pas dépasser le sous-total.');
    }
    const total = sousTotal.sub(remise);

    return client.commande.create({
      data: {
        clientId: dto.clientId,
        sousTotal,
        remise,
        total,
        modeLivraison: dto.modeLivraison,
        idempotencyKey: dto.idempotencyKey,
        articles: { create: articles },
        ...(dto.datePrevue !== undefined ? { datePrevue: new Date(dto.datePrevue) } : {}),
        ...(dto.adresseLivraison !== undefined ? { adresseLivraison: dto.adresseLivraison } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: { articles: true },
    });
  }

  list(tenantId: string, statut?: StatutCommande, clientId?: string) {
    const where: Prisma.CommandeWhereInput = {};
    if (statut !== undefined) {
      where.statut = statut;
    }
    if (clientId !== undefined) {
      where.clientId = clientId;
    }
    return this.tenantPrisma
      .forTenant(tenantId)
      .commande.findMany({ where, orderBy: { createdAt: 'desc' }, include: { articles: true } });
  }

  async findById(tenantId: string, id: string) {
    const commande = await this.tenantPrisma
      .forTenant(tenantId)
      .commande.findUnique({ where: { id }, include: { articles: true } });
    if (!commande) {
      throw new NotFoundException();
    }
    return commande;
  }

  async updateStatut(tenantId: string, id: string, dto: UpdateOrderStatusDto) {
    const commande = await this.findById(tenantId, id);

    if (!estProgression(commande.statut, dto.statut)) {
      throw new ConflictException(
        `Transition ${commande.statut} → ${dto.statut} refusée : aucune régression de statut n'est autorisée.`,
      );
    }

    return this.tenantPrisma.forTenant(tenantId).commande.update({
      where: { id },
      data: { statut: dto.statut },
      include: { articles: true },
    });
  }
}
