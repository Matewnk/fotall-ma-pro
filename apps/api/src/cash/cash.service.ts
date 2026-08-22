import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OperationCaisse, Prisma, TypeOperationCaisse } from '../generated/tenant-client';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';
import { effetSurSolde, TYPES_MONTANT_POSITIF } from './cash.constants';
import { CreateCashOperationDto } from './dto/create-cash-operation.dto';

export type OperationCaisseAvecMonnaie = OperationCaisse & { monnaie?: string };

@Injectable()
export class CashService {
  private readonly logger = new Logger(CashService.name);

  constructor(private readonly tenantPrisma: TenantPrismaFactory) {}

  // Journal append-only : aucune methode update/delete n'existe sur ce
  // service, volontairement (Constitution IV). Une correction est une
  // nouvelle operation AJUSTEMENT_COMPENSATOIRE.
  async enregistrer(
    tenantId: string,
    operateurId: string,
    dto: CreateCashOperationDto,
  ): Promise<OperationCaisseAvecMonnaie> {
    const client = this.tenantPrisma.forTenant(tenantId);

    const existante = await client.operationCaisse.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existante) {
      this.logger.log(`Rejeu idempotent ignoré (doublon réseau) : caisse / ${dto.idempotencyKey}`);
      return existante;
    }

    // Workflow order-to-cash (écran caisse post-commande) : dérive toujours
    // le montant du total réel de la commande — jamais du montant fourni
    // par l'appelant (§ order-to-cash, décisions #4/#8). Ce comportement
    // strict n'est déclenché QUE si montantRecu est fourni, seul signal
    // fiable que l'appelant est le nouveau flux "Encaisser la commande" et
    // non un encaissement manuel partiel/legacy (ex. dashboard.service.ts
    // compterPaiementsEnAttente, qui dépend d'ENCAISSEMENT.montant < total
    // pour détecter un paiement encore incomplet — un flux préexistant,
    // hors périmètre, à ne jamais casser).
    if (
      dto.type === TypeOperationCaisse.ENCAISSEMENT &&
      dto.commandeId !== undefined &&
      dto.montantRecu !== undefined
    ) {
      return this.encaisserCommande(tenantId, operateurId, dto);
    }

    if (dto.montant === undefined) {
      throw new BadRequestException('montant est requis.');
    }
    const montant = new Prisma.Decimal(dto.montant);

    if (TYPES_MONTANT_POSITIF.includes(dto.type) && !montant.greaterThan(0)) {
      throw new BadRequestException(`Le montant doit être strictement positif pour ${dto.type}.`);
    }
    if (dto.type === TypeOperationCaisse.CLOTURE && !montant.equals(0)) {
      throw new BadRequestException(
        'Le montant doit être 0 pour une CLOTURE (marqueur, sans effet sur le solde).',
      );
    }

    return client.operationCaisse.create({
      data: {
        type: dto.type,
        montant,
        operateurId,
        idempotencyKey: dto.idempotencyKey,
        ...(dto.modePaiement !== undefined ? { modePaiement: dto.modePaiement } : {}),
        ...(dto.reference !== undefined ? { reference: dto.reference } : {}),
        ...(dto.commandeId !== undefined ? { commandeId: dto.commandeId } : {}),
        ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
      },
    });
  }

  private async encaisserCommande(
    tenantId: string,
    operateurId: string,
    dto: CreateCashOperationDto,
  ): Promise<OperationCaisseAvecMonnaie> {
    const client = this.tenantPrisma.forTenant(tenantId);
    const commandeId = dto.commandeId as string;

    const commande = await client.commande.findUnique({ where: { id: commandeId } });
    if (!commande) {
      throw new NotFoundException('Commande introuvable.');
    }

    const dejaEncaissee = await client.operationCaisse.findFirst({
      where: { commandeId, type: TypeOperationCaisse.ENCAISSEMENT },
    });
    if (dejaEncaissee) {
      throw new ConflictException('Cette commande est déjà encaissée.');
    }

    const montant = commande.total;
    const montantRecu = new Prisma.Decimal(dto.montantRecu as number);
    if (montantRecu.lessThan(montant)) {
      throw new BadRequestException(
        `Montant reçu insuffisant : ${montant.toString()} FCFA dus, ${montantRecu.toString()} FCFA reçus.`,
      );
    }
    const monnaie = montantRecu.sub(montant);

    const operation = await client.operationCaisse.create({
      data: {
        type: TypeOperationCaisse.ENCAISSEMENT,
        montant,
        operateurId,
        idempotencyKey: dto.idempotencyKey,
        commandeId,
        ...(dto.modePaiement !== undefined ? { modePaiement: dto.modePaiement } : {}),
        ...(dto.reference !== undefined ? { reference: dto.reference } : {}),
      },
    });

    return { ...operation, monnaie: monnaie.toString() };
  }

  // Journal chronologique complet, jamais filtré par acteur : la caisse
  // est partagée par tous les opérateurs d'un même tenant.
  journal(tenantId: string, type?: TypeOperationCaisse) {
    const where: Prisma.OperationCaisseWhereInput = {};
    if (type !== undefined) {
      where.type = type;
    }
    return this.tenantPrisma
      .forTenant(tenantId)
      .operationCaisse.findMany({ where, orderBy: { createdAt: 'asc' } });
  }

  // Solde = somme des effets signés de chaque événement, recalculée à
  // chaque lecture : déterministe, jamais un compteur mutable, et
  // indépendante de l'ordre d'arrivée (addition commutative) — propriété
  // requise pour la synchronisation offline (016).
  async solde(tenantId: string): Promise<Prisma.Decimal> {
    const operations = await this.tenantPrisma.forTenant(tenantId).operationCaisse.findMany();
    return operations.reduce(
      (acc, operation) => acc.add(effetSurSolde(operation.type, operation.montant)),
      new Prisma.Decimal(0),
    );
  }
}
