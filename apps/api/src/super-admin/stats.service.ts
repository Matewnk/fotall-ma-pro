import { Injectable } from '@nestjs/common';
import {
  PlanCommercial,
  Prisma,
  StatutAbonnement,
  StatutLicence,
  TypeEvenementPaiement,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MOIS_HISTORIQUE = 12;
const SEUIL_ALERTE_EXPIRATION_JOURS = 7;

function debutDuMois(reference: Date): Date {
  return new Date(reference.getFullYear(), reference.getMonth(), 1);
}

function moisAnnee(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function joursEntre(debut: Date, fin: Date): number {
  return Math.ceil((fin.getTime() - debut.getTime()) / (24 * 60 * 60 * 1000));
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  // Vue plateforme du SUPER_ADMIN — chaque champ est calculé depuis des
  // données réellement enregistrées (abonnements, journal de paiements,
  // licences), jamais inventé côté frontend. Une plateforme peut mélanger
  // les devises entre tenants (Tenant.devise) : les agrégats monétaires
  // (revenu mensuel, revenu par plan, historique) portent donc uniquement
  // sur la devise la plus représentée parmi les abonnements actifs — la
  // "devise principale" — les autres sont signalées séparément plutôt que
  // sommées à tort avec elle.
  async global() {
    const [totalTenants, parStatutLicence, devisePrincipale] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.licence.groupBy({ by: ['statut'], _count: { _all: true } }),
      this.determinerDevisePrincipale(),
    ]);

    const repartitionLicences = Object.fromEntries(
      Object.values(StatutLicence).map((statut) => [
        statut,
        parStatutLicence.find((entry) => entry.statut === statut)?._count._all ?? 0,
      ]),
    ) as Record<StatutLicence, number>;

    const [
      revenuParDevise,
      nouveauxAbonnementsMois,
      repartitionAbonnements,
      revenuParPlan,
      evolutionRevenusMensuels,
      inscriptionsRecentes,
      alertes,
    ] = await Promise.all([
      this.revenuMensuelParDevise(),
      this.nouveauxAbonnementsDuMois(),
      this.repartitionStatutAbonnements(),
      this.revenuParPlan(devisePrincipale),
      this.evolutionRevenusMensuels(devisePrincipale),
      this.inscriptionsRecentes(),
      this.alertes(),
    ]);

    const revenuMensuel = revenuParDevise.find((entry) => entry.devise === devisePrincipale) ?? {
      devise: devisePrincipale,
      montant: 0,
    };
    const revenuMensuelAutresDevises = revenuParDevise.filter(
      (entry) => entry.devise !== devisePrincipale,
    );

    const abonnementsPourRetention =
      repartitionAbonnements.ACTIF +
      repartitionAbonnements.EN_RETARD +
      repartitionAbonnements.ANNULE;
    // Part des abonnements en règle (ACTIF ou EN_RETARD, donc pas encore
    // résiliés) parmi tous les abonnements jamais créés — pas une rétention
    // de cohorte classique (aucun historique de snapshot MRR disponible),
    // mais un indicateur réel plutôt qu'un chiffre inventé.
    const tauxRetention =
      abonnementsPourRetention === 0
        ? 100
        : Math.round(
            ((repartitionAbonnements.ACTIF + repartitionAbonnements.EN_RETARD) /
              abonnementsPourRetention) *
              1000,
          ) / 10;

    return {
      totalTenants,
      repartitionLicences,
      revenuMensuel,
      revenuMensuelAutresDevises,
      nouveauxAbonnementsMois,
      tauxRetention,
      revenuParPlan,
      evolutionRevenusMensuels,
      inscriptionsRecentes,
      alertes,
    };
  }

  private async determinerDevisePrincipale(): Promise<string> {
    const parDevise = await this.prisma.abonnement.groupBy({
      by: ['devise'],
      where: { statut: StatutAbonnement.ACTIF },
      _count: { _all: true },
    });
    const [plusRepresentee] = [...parDevise].sort((a, b) => b._count._all - a._count._all);
    return plusRepresentee?.devise ?? 'XOF';
  }

  private async revenuMensuelParDevise(): Promise<{ devise: string; montant: number }[]> {
    const parDevise = await this.prisma.abonnement.groupBy({
      by: ['devise'],
      where: { statut: StatutAbonnement.ACTIF },
      _sum: { montant: true },
    });
    return parDevise.map((entry) => ({
      devise: entry.devise,
      montant: entry._sum.montant?.toNumber() ?? 0,
    }));
  }

  private async nouveauxAbonnementsDuMois(): Promise<number> {
    return this.prisma.abonnement.count({
      where: { createdAt: { gte: debutDuMois(new Date()) } },
    });
  }

  private async repartitionStatutAbonnements(): Promise<Record<StatutAbonnement, number>> {
    const parStatut = await this.prisma.abonnement.groupBy({
      by: ['statut'],
      _count: { _all: true },
    });
    return Object.fromEntries(
      Object.values(StatutAbonnement).map((statut) => [
        statut,
        parStatut.find((entry) => entry.statut === statut)?._count._all ?? 0,
      ]),
    ) as Record<StatutAbonnement, number>;
  }

  private async revenuParPlan(
    devisePrincipale: string,
  ): Promise<{ plan: PlanCommercial; montant: number }[]> {
    const parPlan = await this.prisma.abonnement.groupBy({
      by: ['plan'],
      where: { statut: StatutAbonnement.ACTIF, devise: devisePrincipale },
      _sum: { montant: true },
    });
    return Object.values(PlanCommercial).map((plan) => ({
      plan,
      montant: parPlan.find((entry) => entry.plan === plan)?._sum.montant?.toNumber() ?? 0,
    }));
  }

  // Revenus réellement encaissés (JournalPaiement de type PAIEMENT_REUSSI)
  // par mois, sur les 12 derniers mois — reconstituer une véritable
  // évolution du MRR demanderait un historique de snapshots que rien ne
  // conserve aujourd'hui ; l'encaissement mensuel réel est l'indicateur le
  // plus proche que les données permettent honnêtement.
  private async evolutionRevenusMensuels(
    devisePrincipale: string,
  ): Promise<{ mois: string; montant: number }[]> {
    const debut = debutDuMois(new Date());
    debut.setMonth(debut.getMonth() - (MOIS_HISTORIQUE - 1));

    const paiements = await this.prisma.journalPaiement.findMany({
      where: {
        type: TypeEvenementPaiement.PAIEMENT_REUSSI,
        createdAt: { gte: debut },
        OR: [{ devise: devisePrincipale }, { devise: null }],
      },
      select: { montant: true, createdAt: true },
    });

    const parMois = new Map<string, Prisma.Decimal>();
    for (let i = 0; i < MOIS_HISTORIQUE; i++) {
      const reference = new Date(debut.getFullYear(), debut.getMonth() + i, 1);
      parMois.set(moisAnnee(reference), new Prisma.Decimal(0));
    }
    for (const paiement of paiements) {
      const cle = moisAnnee(paiement.createdAt);
      const actuel = parMois.get(cle);
      if (actuel && paiement.montant) {
        parMois.set(cle, actuel.plus(paiement.montant));
      }
    }

    return Array.from(parMois.entries()).map(([mois, montant]) => ({
      mois,
      montant: montant.toNumber(),
    }));
  }

  private async inscriptionsRecentes() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        nomPressing: true,
        sousDomaine: true,
        plan: true,
        createdAt: true,
        licence: { select: { statut: true } },
      },
    });
    return tenants.map((tenant) => ({
      tenantId: tenant.id,
      nomPressing: tenant.nomPressing,
      sousDomaine: tenant.sousDomaine,
      plan: tenant.plan,
      createdAt: tenant.createdAt,
      statutLicence: tenant.licence?.statut ?? null,
    }));
  }

  private async alertes() {
    const [abonnementsEnRetard, licencesEssaiProches, licencesActivesProches] = await Promise.all([
      this.prisma.abonnement.findMany({
        where: { statut: StatutAbonnement.EN_RETARD },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          montant: true,
          devise: true,
          updatedAt: true,
          tenant: { select: { id: true, nomPressing: true } },
        },
      }),
      this.prisma.licence.findMany({
        where: {
          statut: StatutLicence.ESSAI,
          dateFinEssai: {
            gte: new Date(),
            lte: new Date(Date.now() + SEUIL_ALERTE_EXPIRATION_JOURS * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          dateFinEssai: true,
          tenant: { select: { id: true, nomPressing: true } },
        },
      }),
      this.prisma.licence.findMany({
        where: {
          statut: StatutLicence.ACTIVE,
          dateExpirationCourante: {
            gte: new Date(),
            lte: new Date(Date.now() + SEUIL_ALERTE_EXPIRATION_JOURS * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          dateExpirationCourante: true,
          tenant: { select: { id: true, nomPressing: true } },
        },
      }),
    ]);

    const maintenant = new Date();
    const licencesExpirantBientot = [
      ...licencesEssaiProches.map((licence) => ({
        tenantId: licence.tenant.id,
        nomPressing: licence.tenant.nomPressing,
        statut: StatutLicence.ESSAI,
        dateEcheance: licence.dateFinEssai,
        joursRestants: joursEntre(maintenant, licence.dateFinEssai),
      })),
      ...licencesActivesProches
        .filter((licence) => licence.dateExpirationCourante !== null)
        .map((licence) => ({
          tenantId: licence.tenant.id,
          nomPressing: licence.tenant.nomPressing,
          statut: StatutLicence.ACTIVE,
          dateEcheance: licence.dateExpirationCourante as Date,
          joursRestants: joursEntre(maintenant, licence.dateExpirationCourante as Date),
        })),
    ].sort((a, b) => a.joursRestants - b.joursRestants);

    return {
      paiementsEnRetard: abonnementsEnRetard.map((abonnement) => ({
        tenantId: abonnement.tenant.id,
        nomPressing: abonnement.tenant.nomPressing,
        montant: abonnement.montant.toNumber(),
        devise: abonnement.devise,
        depuis: abonnement.updatedAt,
      })),
      licencesExpirantBientot,
    };
  }
}
