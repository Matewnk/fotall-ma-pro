import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, TypeOperationCaisse } from '../generated/tenant-client';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';
import { effetSurSolde, TYPES_MONTANT_POSITIF } from './cash.constants';
import { CreateCashOperationDto } from './dto/create-cash-operation.dto';

@Injectable()
export class CashService {
  private readonly logger = new Logger(CashService.name);

  constructor(private readonly tenantPrisma: TenantPrismaFactory) {}

  // Journal append-only : aucune methode update/delete n'existe sur ce
  // service, volontairement (Constitution IV). Une correction est une
  // nouvelle operation AJUSTEMENT_COMPENSATOIRE.
  async enregistrer(tenantId: string, operateurId: string, dto: CreateCashOperationDto) {
    const client = this.tenantPrisma.forTenant(tenantId);

    const existante = await client.operationCaisse.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existante) {
      this.logger.log(`Rejeu idempotent ignoré (doublon réseau) : caisse / ${dto.idempotencyKey}`);
      return existante;
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
