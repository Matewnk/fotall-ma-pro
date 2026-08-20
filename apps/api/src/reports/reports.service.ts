import { Injectable } from '@nestjs/common';
import {
  ModeLivraison,
  Prisma,
  StatutCommande,
  TypeOperationCaisse,
} from '../generated/tenant-client';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';
import { effetSurSolde } from '../cash/cash.constants';
import { JOURS_PERIODE_DEFAUT, LIMITE_CLASSEMENT_DEFAUT } from './reports.constants';
import { TableauRapport } from './reports.types';

function debutJournee(date: Date): Date {
  const debut = new Date(date);
  debut.setHours(0, 0, 0, 0);
  return debut;
}

function finJournee(date: Date): Date {
  const fin = new Date(date);
  fin.setHours(23, 59, 59, 999);
  return fin;
}

export function periodeParDefaut(from?: Date, to?: Date): { from: Date; to: Date } {
  const finPeriode = to ?? new Date();
  const debutPeriode =
    from ?? new Date(finPeriode.getTime() - JOURS_PERIODE_DEFAUT * 24 * 60 * 60 * 1000);
  return { from: debutJournee(debutPeriode), to: finJournee(finPeriode) };
}

@Injectable()
export class ReportsService {
  constructor(private readonly tenantPrisma: TenantPrismaFactory) {}

  // 10.1 "caisse quotidienne" : journal du jour + sous-totaux par type +
  // solde d'ouverture (report des jours précédents) et de clôture. Relit
  // l'historique complet jusqu'à la fin du jour demandé, comme
  // CashService.solde() (010) — même logique de calcul déterministe par
  // rejeu, jamais un compteur mutable.
  async caisseQuotidienne(tenantId: string, date: Date): Promise<TableauRapport> {
    const debut = debutJournee(date);
    const fin = finJournee(date);
    const operations = await this.tenantPrisma.forTenant(tenantId).operationCaisse.findMany({
      where: { createdAt: { lte: fin } },
      orderBy: { createdAt: 'asc' },
    });

    let soldeOuverture = new Prisma.Decimal(0);
    const operationsDuJour: typeof operations = [];
    for (const operation of operations) {
      if (operation.createdAt < debut) {
        soldeOuverture = soldeOuverture.add(effetSurSolde(operation.type, operation.montant));
      } else {
        operationsDuJour.push(operation);
      }
    }

    const totauxParType = new Map<TypeOperationCaisse, Prisma.Decimal>();
    let soldeCloture = soldeOuverture;
    for (const operation of operationsDuJour) {
      totauxParType.set(
        operation.type,
        (totauxParType.get(operation.type) ?? new Prisma.Decimal(0)).add(operation.montant),
      );
      soldeCloture = soldeCloture.add(effetSurSolde(operation.type, operation.montant));
    }

    return {
      colonnes: ['Heure', 'Type', 'Montant', 'Mode de paiement', 'Référence'],
      lignes: operationsDuJour.map((operation) => [
        operation.createdAt.toISOString(),
        operation.type,
        operation.montant.toString(),
        operation.modePaiement ?? '',
        operation.reference ?? '',
      ]),
      resume: {
        soldeOuverture: soldeOuverture.toString(),
        soldeCloture: soldeCloture.toString(),
        ...Object.fromEntries(
          Array.from(totauxParType.entries()).map(([type, total]) => [
            `total${type}`,
            total.toString(),
          ]),
        ),
      },
    };
  }

  // 10.1 "activité quotidienne/hebdomadaire/mensuelle" : la période est un
  // intervalle libre (from/to) plutôt qu'une énumération jour/semaine/mois
  // — un seul calcul couvre les trois granularités demandées par le
  // cahier des charges, au choix de l'appelant.
  async activite(tenantId: string, from?: Date, to?: Date): Promise<TableauRapport> {
    const { from: debut, to: fin } = periodeParDefaut(from, to);
    const client = this.tenantPrisma.forTenant(tenantId);

    const [parStatut, agregat] = await Promise.all([
      client.commande.groupBy({
        by: ['statut'],
        where: { createdAt: { gte: debut, lte: fin } },
        _count: { _all: true },
      }),
      client.commande.aggregate({
        where: { createdAt: { gte: debut, lte: fin } },
        _count: { _all: true },
        _sum: { total: true },
      }),
    ]);

    return {
      colonnes: ['Statut', 'Nombre de commandes'],
      lignes: parStatut.map((entree) => [entree.statut, entree._count._all]),
      resume: {
        periodeDebut: debut.toISOString().slice(0, 10),
        periodeFin: fin.toISOString().slice(0, 10),
        totalCommandes: agregat._count._all,
        chiffreAffaires: (agregat._sum.total ?? new Prisma.Decimal(0)).toString(),
      },
    };
  }

  // 10.1 "recettes par service" et "services les plus utilisés" partagent
  // le même agrégat sous-jacent (quantité + montant par service sur la
  // période) — seul l'ordre de tri diffère entre les deux rapports.
  async recettesParService(tenantId: string, from?: Date, to?: Date): Promise<TableauRapport> {
    const lignes = await this.agregatsParService(tenantId, from, to);
    lignes.sort((a, b) => b.recettes.cmp(a.recettes));
    return this.tableauAgregatsService(lignes);
  }

  async servicesPopulaires(tenantId: string, from?: Date, to?: Date): Promise<TableauRapport> {
    const lignes = await this.agregatsParService(tenantId, from, to);
    lignes.sort((a, b) => b.quantite - a.quantite);
    return this.tableauAgregatsService(lignes);
  }

  private tableauAgregatsService(
    lignes: { code: string; intitule: string; quantite: number; recettes: Prisma.Decimal }[],
  ): TableauRapport {
    return {
      colonnes: ['Code', 'Service', 'Quantité vendue', 'Recettes'],
      lignes: lignes.map((ligne) => [
        ligne.code,
        ligne.intitule,
        ligne.quantite,
        ligne.recettes.toString(),
      ]),
    };
  }

  private async agregatsParService(tenantId: string, from?: Date, to?: Date) {
    const { from: debut, to: fin } = periodeParDefaut(from, to);
    const client = this.tenantPrisma.forTenant(tenantId);

    const agregats = await client.commandeArticle.groupBy({
      by: ['serviceId'],
      where: { commande: { createdAt: { gte: debut, lte: fin } } },
      _sum: { quantite: true, sousTotal: true },
    });
    if (agregats.length === 0) {
      return [];
    }

    const services = await client.service.findMany({
      where: { id: { in: agregats.map((entree) => entree.serviceId) } },
    });
    const serviceParId = new Map(services.map((service) => [service.id, service]));

    return agregats.map((entree) => {
      const service = serviceParId.get(entree.serviceId);
      return {
        code: service?.code ?? entree.serviceId,
        intitule: service?.intitule ?? '(service supprimé)',
        quantite: entree._sum.quantite ?? 0,
        recettes: entree._sum.sousTotal ?? new Prisma.Decimal(0),
      };
    });
  }

  // 10.1 "top clients" : classement par montant total commandé sur la
  // période, limité (LIMITE_CLASSEMENT_DEFAUT par défaut).
  async topClients(
    tenantId: string,
    from?: Date,
    to?: Date,
    limite = LIMITE_CLASSEMENT_DEFAUT,
  ): Promise<TableauRapport> {
    const { from: debut, to: fin } = periodeParDefaut(from, to);
    const client = this.tenantPrisma.forTenant(tenantId);

    const agregats = await client.commande.groupBy({
      by: ['clientId'],
      where: { createdAt: { gte: debut, lte: fin } },
      _sum: { total: true },
      _count: { _all: true },
    });

    const tries = agregats
      .map((entree) => ({
        clientId: entree.clientId,
        total: entree._sum.total ?? new Prisma.Decimal(0),
        nombreCommandes: entree._count._all,
      }))
      .sort((a, b) => b.total.cmp(a.total))
      .slice(0, limite);

    const clients = await client.client.findMany({
      where: { id: { in: tries.map((entree) => entree.clientId) } },
    });
    const clientParId = new Map(clients.map((c) => [c.id, c]));

    return {
      colonnes: ['Client', 'Téléphone', 'Nombre de commandes', 'Total commandé'],
      lignes: tries.map((entree) => {
        const c = clientParId.get(entree.clientId);
        return [
          c?.nom ?? '(client supprimé)',
          c?.telephone ?? '',
          entree.nombreCommandes,
          entree.total.toString(),
        ];
      }),
    };
  }

  // 10.1 "livraisons / retraits" : répartition des commandes de la
  // période par mode de livraison.
  async livraisonsRetraits(tenantId: string, from?: Date, to?: Date): Promise<TableauRapport> {
    const { from: debut, to: fin } = periodeParDefaut(from, to);
    const agregats = await this.tenantPrisma.forTenant(tenantId).commande.groupBy({
      by: ['modeLivraison'],
      where: { createdAt: { gte: debut, lte: fin } },
      _count: { _all: true },
    });

    const parMode = new Map(agregats.map((entree) => [entree.modeLivraison, entree._count._all]));
    return {
      colonnes: ['Mode', 'Nombre de commandes'],
      lignes: Object.values(ModeLivraison).map((mode) => [mode, parMode.get(mode) ?? 0]),
    };
  }

  // 10.1 "commandes en retard" : liste (pas seulement un compteur, à la
  // différence de l'alerte du tableau de bord, 013) — nécessaire pour
  // qu'un ADMIN puisse relancer les clients concernés.
  async commandesEnRetard(tenantId: string): Promise<TableauRapport> {
    const maintenant = new Date();
    const commandes = await this.tenantPrisma.forTenant(tenantId).commande.findMany({
      where: { statut: { not: StatutCommande.LIVRE }, datePrevue: { lt: maintenant } },
      include: { client: true },
      orderBy: { datePrevue: 'asc' },
    });

    return {
      colonnes: ['Numéro', 'Client', 'Téléphone', 'Date prévue', 'Statut', 'Total'],
      lignes: commandes.map((commande) => [
        commande.numero,
        commande.client.nom,
        commande.client.telephone,
        commande.datePrevue?.toISOString() ?? '',
        commande.statut,
        commande.total.toString(),
      ]),
    };
  }

  // 10.1 "paiements" : répartition des encaissements de la période par
  // mode de paiement (010-cash).
  async paiements(tenantId: string, from?: Date, to?: Date): Promise<TableauRapport> {
    const { from: debut, to: fin } = periodeParDefaut(from, to);
    const agregats = await this.tenantPrisma.forTenant(tenantId).operationCaisse.groupBy({
      by: ['modePaiement'],
      where: {
        type: TypeOperationCaisse.ENCAISSEMENT,
        createdAt: { gte: debut, lte: fin },
      },
      _sum: { montant: true },
      _count: { _all: true },
    });

    return {
      colonnes: ['Mode de paiement', 'Nombre', 'Total encaissé'],
      lignes: agregats.map((entree) => [
        entree.modePaiement ?? '(non renseigné)',
        entree._count._all,
        (entree._sum.montant ?? new Prisma.Decimal(0)).toString(),
      ]),
    };
  }
}
