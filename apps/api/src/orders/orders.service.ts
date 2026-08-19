import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ModeLivraison, Prisma, StatutCommande } from '../generated/tenant-client';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { estProgression } from './orders.constants';

// Evenement emis pour chaque statut atteint (sauf EN_ATTENTE, l'etat
// initial). Consomme par NotificationsEventsListener (012) : ce service
// n'appelle jamais un fournisseur de notification directement.
const EVENEMENT_PAR_STATUT: Partial<Record<StatutCommande, string>> = {
  [StatutCommande.EN_COURS]: 'commande.en_cours',
  [StatutCommande.PRET]: 'commande.prete',
  [StatutCommande.LIVRE]: 'commande.livree',
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaFactory,
    private readonly events: EventEmitter2,
  ) {}

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

    const commande = await client.commande.create({
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

    this.events.emit('commande.creee', {
      tenantId,
      commandeId: commande.id,
      clientId: commande.clientId,
      numero: commande.numero,
      modeLivraison: commande.modeLivraison,
    });

    return commande;
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

    const misAJour = await this.tenantPrisma.forTenant(tenantId).commande.update({
      where: { id },
      data: { statut: dto.statut },
      include: { articles: true },
    });

    const nomEvenement = EVENEMENT_PAR_STATUT[dto.statut];
    if (nomEvenement) {
      this.events.emit(nomEvenement, {
        tenantId,
        commandeId: misAJour.id,
        clientId: misAJour.clientId,
        numero: misAJour.numero,
        modeLivraison: misAJour.modeLivraison,
      });
    }

    return misAJour;
  }
}
