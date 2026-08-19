import { Injectable } from '@nestjs/common';
import { StatutLicence } from '@prisma/client';
import { LicenceService } from '../licence/licence.service';
import { ALERTE_AVANT_EXPIRATION_HEURES } from '../licence/licence.constants';
import {
  ModeLivraison,
  Prisma,
  StatutCommande,
  TypeOperationCaisse,
} from '../generated/tenant-client';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';
import {
  FENETRE_URGENCE_HEURES,
  NB_COMMANDES_RECENTES,
  NB_JOURS_REVENUS,
} from './dashboard.constants';

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

@Injectable()
export class DashboardService {
  constructor(
    private readonly tenantPrisma: TenantPrismaFactory,
    private readonly licenceService: LicenceService,
  ) {}

  async obtenir(tenantId: string) {
    const client = this.tenantPrisma.forTenant(tenantId);
    const maintenant = new Date();
    const debut = debutJournee(maintenant);
    const fin = finJournee(maintenant);

    const [
      commandesDuJour,
      chiffreAffairesDuJour,
      articlesEnAttente,
      livraisonsPrevuesAujourdHui,
      commandesEnRetard,
      commandesUrgentes,
      revenus7DerniersJours,
      commandesRecentes,
      paiementsEnAttente,
      licence,
    ] = await Promise.all([
      client.commande.count({ where: { createdAt: { gte: debut, lte: fin } } }),
      client.commande.aggregate({
        where: { createdAt: { gte: debut, lte: fin } },
        _sum: { total: true },
      }),
      client.commandeArticle.aggregate({
        where: { commande: { statut: { not: StatutCommande.LIVRE } } },
        _sum: { quantite: true },
      }),
      client.commande.count({
        where: {
          statut: { not: StatutCommande.LIVRE },
          modeLivraison: ModeLivraison.LIVRAISON,
          datePrevue: { gte: debut, lte: fin },
        },
      }),
      client.commande.count({
        where: { statut: { not: StatutCommande.LIVRE }, datePrevue: { lt: maintenant } },
      }),
      client.commande.count({
        where: {
          statut: { not: StatutCommande.LIVRE },
          datePrevue: {
            gte: maintenant,
            lte: new Date(maintenant.getTime() + FENETRE_URGENCE_HEURES * 60 * 60 * 1000),
          },
        },
      }),
      this.revenusParJour(tenantId, maintenant),
      client.commande.findMany({
        orderBy: { createdAt: 'desc' },
        take: NB_COMMANDES_RECENTES,
        include: { client: true },
      }),
      this.compterPaiementsEnAttente(tenantId),
      this.licenceService.getStatut(tenantId),
    ]);

    const enEssai = licence.statut === StatutLicence.ESSAI;
    const heuresAvantFinEssai =
      (licence.dateFinEssai.getTime() - maintenant.getTime()) / (60 * 60 * 1000);
    const joursRestants = enEssai ? Math.ceil(heuresAvantFinEssai / 24) : null;
    const licenceProcheExpiration =
      enEssai && heuresAvantFinEssai <= ALERTE_AVANT_EXPIRATION_HEURES;

    return {
      kpis: {
        commandesDuJour,
        chiffreAffairesDuJour: chiffreAffairesDuJour._sum.total ?? new Prisma.Decimal(0),
        articlesEnAttente: articlesEnAttente._sum.quantite ?? 0,
        livraisonsPrevuesAujourdHui,
        commandesEnRetard,
        revenus7DerniersJours,
      },
      commandesRecentes: commandesRecentes.map((commande) => ({
        numero: commande.numero,
        client: { id: commande.client.id, nom: commande.client.nom },
        date: commande.createdAt,
        montant: commande.total,
        statut: commande.statut,
      })),
      alertes: {
        commandesUrgentes,
        retards: commandesEnRetard,
        paiementsEnAttente,
        livraisonsDuJour: livraisonsPrevuesAujourdHui,
        // Aucune synchronisation offline n'existe encore (016-mobile-offline
        // n'est pas implémenté) : ne peut structurellement jamais produire
        // d'erreur pour l'instant.
        erreursSynchronisation: 0,
        licenceProcheExpiration: { active: licenceProcheExpiration, joursRestants },
      },
    };
  }

  private async revenusParJour(tenantId: string, maintenant: Date) {
    const client = this.tenantPrisma.forTenant(tenantId);
    const jours = Array.from({ length: NB_JOURS_REVENUS }, (_, index) => {
      const date = new Date(maintenant);
      date.setDate(date.getDate() - (NB_JOURS_REVENUS - 1 - index));
      return date;
    });

    const totaux = await Promise.all(
      jours.map((jour) =>
        client.commande.aggregate({
          where: { createdAt: { gte: debutJournee(jour), lte: finJournee(jour) } },
          _sum: { total: true },
        }),
      ),
    );

    return jours.map((jour, index) => ({
      date: debutJournee(jour).toISOString().slice(0, 10),
      total: totaux[index]?._sum.total ?? new Prisma.Decimal(0),
    }));
  }

  // Une commande est "en attente de paiement" dès que le total encaissé qui
  // lui est rattaché (opérations OperationCaisse de type ENCAISSEMENT,
  // 010-cash) est inférieur à son total — quel que soit son statut de
  // traitement : une commande déjà livrée mais non soldée reste à relancer.
  private async compterPaiementsEnAttente(tenantId: string): Promise<number> {
    const client = this.tenantPrisma.forTenant(tenantId);
    const [commandes, encaissements] = await Promise.all([
      client.commande.findMany({ select: { id: true, total: true } }),
      client.operationCaisse.groupBy({
        by: ['commandeId'],
        where: { type: TypeOperationCaisse.ENCAISSEMENT, commandeId: { not: null } },
        _sum: { montant: true },
      }),
    ]);

    const encaisseParCommande = new Map(
      encaissements.map((entree) => [entree.commandeId as string, entree._sum.montant]),
    );

    return commandes.filter((commande) => {
      const paye = encaisseParCommande.get(commande.id) ?? new Prisma.Decimal(0);
      return paye.lessThan(commande.total);
    }).length;
  }
}
