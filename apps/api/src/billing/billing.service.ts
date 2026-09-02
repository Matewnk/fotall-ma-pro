import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Abonnement,
  Facture,
  PlanCommercial,
  Prisma,
  StatutAbonnement,
  StatutFacture,
  StatutLicence,
  TypeEvenementPaiement,
} from '@prisma/client';
import { LicenceService } from '../licence/licence.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACTEUR_SYSTEME_FACTURATION,
  JOURS_CYCLE_FACTURATION,
  JOURS_GRACE_AVANT_SUSPENSION,
} from './billing.constants';
import { CreateAbonnementDto } from './dto/create-abonnement.dto';
import { WebhookPaiementDto } from './dto/webhook-paiement.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly licenceService: LicenceService,
  ) {}

  // §14.1 : en V1 seul le SUPER_ADMIN provisionne un abonnement (le
  // tenant ne modifie jamais directement l'état de sa licence). La
  // création active immédiatement la licence — un abonnement payé
  // souscrit alors que le tenant est encore en ESSAI/EXPIREE le fait
  // basculer en ACTIVE.
  async creerAbonnement(tenantId: string, dto: CreateAbonnementDto): Promise<Abonnement> {
    const existant = await this.prisma.abonnement.findUnique({ where: { tenantId } });
    if (existant) {
      throw new ConflictException('Un abonnement existe déjà pour ce tenant.');
    }

    const abonnement = await this.prisma.abonnement.create({
      data: {
        tenantId,
        plan: dto.plan,
        modePaiement: dto.modePaiement,
        montant: new Prisma.Decimal(dto.montant),
        dateProchaineFacturation: new Date(dto.dateProchaineFacturation),
        ...(dto.devise !== undefined ? { devise: dto.devise } : {}),
        ...(dto.referenceProvider !== undefined
          ? { referenceProvider: dto.referenceProvider }
          : {}),
      },
    });

    await this.prisma.tenant.update({ where: { id: tenantId }, data: { plan: dto.plan } });

    const licence = await this.licenceService.getStatut(tenantId);
    if (licence.statut !== StatutLicence.ACTIVE) {
      await this.licenceService.activer(
        tenantId,
        ACTEUR_SYSTEME_FACTURATION,
        `abonnement-creation:${abonnement.id}`,
        'Abonnement créé par le Super-Administrateur',
      );
    }

    return abonnement;
  }

  // §022-super-admin-enhancement : vue globale multi-tenant, control-plane
  // uniquement (Abonnement/Tenant vivent hors du schéma tenant) — ne viole
  // pas l'isolation puisqu'aucune donnée métier du tenant n'est lue.
  async listerFacturationGlobale(filtres: {
    tenantId?: string | undefined;
    statut?: StatutAbonnement | undefined;
    plan?: string | undefined;
  }) {
    const abonnements = await this.prisma.abonnement.findMany({
      where: {
        ...(filtres.tenantId ? { tenantId: filtres.tenantId } : {}),
        ...(filtres.statut ? { statut: filtres.statut } : {}),
        ...(filtres.plan && Object.values(PlanCommercial).includes(filtres.plan as PlanCommercial)
          ? { plan: filtres.plan as PlanCommercial }
          : {}),
      },
      select: {
        id: true,
        tenantId: true,
        plan: true,
        modePaiement: true,
        montant: true,
        devise: true,
        statut: true,
        dateProchaineFacturation: true,
        referenceProvider: true,
        createdAt: true,
        tenant: { select: { nomPressing: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return abonnements.map(({ tenant, montant, ...abonnement }) => ({
      ...abonnement,
      montant: montant.toNumber(),
      nomPressing: tenant.nomPressing,
    }));
  }

  // §Renouvellement self-service : ajoute l'état Licence (source de
  // vérité de la date d'expiration réelle et du statut ESSAI/ACTIVE/
  // EXPIREE/SUSPENDUE — Abonnement.statut ne couvre que l'état de
  // facturation, pas l'accès réel). Additif uniquement, aucun champ
  // existant retiré — la vue globale Super-Admin
  // (billing.controller.ts#obtenir) qui réutilise cette même méthode
  // n'est pas cassée par l'ajout.
  async obtenirFacturation(tenantId: string) {
    const abonnement = await this.prisma.abonnement.findUnique({
      where: { tenantId },
      include: { journal: { orderBy: { createdAt: 'desc' } } },
    });
    if (!abonnement) {
      throw new NotFoundException('Aucun abonnement pour ce tenant.');
    }
    const licence = await this.licenceService.getStatut(tenantId);
    return {
      ...abonnement,
      licence: {
        statut: licence.statut,
        dateActivation: licence.dateActivation,
        dateExpirationCourante: licence.dateExpirationCourante,
      },
    };
  }

  // §14.1 "événements de paiement idempotents" : un rejeu de webhook
  // (retry réseau côté fournisseur) ne doit jamais appliquer deux fois le
  // même évènement — idempotencyKey unique en base (journal_paiements).
  async traiterEvenementPaiement(dto: WebhookPaiementDto): Promise<void> {
    const dejaTraite = await this.prisma.journalPaiement.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (dejaTraite) {
      this.logger.log(`Rejeu idempotent ignoré : paiement / ${dto.idempotencyKey}`);
      return;
    }

    const abonnement = await this.prisma.abonnement.findUnique({
      where: { tenantId: dto.tenantId },
    });
    if (!abonnement) {
      throw new NotFoundException(`Aucun abonnement pour le tenant ${dto.tenantId}.`);
    }

    await this.prisma.journalPaiement.create({
      data: {
        tenantId: dto.tenantId,
        abonnementId: abonnement.id,
        type: dto.type as TypeEvenementPaiement,
        idempotencyKey: dto.idempotencyKey,
        ...(dto.montant !== undefined ? { montant: new Prisma.Decimal(dto.montant) } : {}),
        ...(dto.devise !== undefined ? { devise: dto.devise } : {}),
        ...(dto.referenceProvider !== undefined
          ? { referenceProvider: dto.referenceProvider }
          : {}),
      },
    });

    if (dto.type === TypeEvenementPaiement.PAIEMENT_REUSSI) {
      // §Renouvellement self-service : si l'évènement référence une
      // facture précise (referenceProvider = Facture.id, posé par
      // InvoicesService.creerPourRenouvellementTenant), la durée réelle
      // du renouvellement (periodeFin - periodeDebut) prime sur le cycle
      // fixe — sans quoi un renouvellement de 12 mois ne prolongerait
      // l'abonnement que de 30 jours. Absent (flux Super-Admin existant,
      // ou webhook sans référence) : comportement inchangé.
      const factureAssociee = dto.referenceProvider
        ? await this.prisma.facture.findFirst({
            where: {
              id: dto.referenceProvider,
              tenantId: dto.tenantId,
              statut: StatutFacture.EMISE,
            },
          })
        : null;
      await this.traiterPaiementReussi(dto.tenantId, abonnement, factureAssociee);
    } else {
      await this.prisma.abonnement.update({
        where: { id: abonnement.id },
        data: { statut: StatutAbonnement.EN_RETARD },
      });
    }
  }

  private async traiterPaiementReussi(
    tenantId: string,
    abonnement: Abonnement,
    factureAssociee: Facture | null,
  ): Promise<void> {
    const dureeJours = factureAssociee
      ? Math.round(
          (factureAssociee.periodeFin.getTime() - factureAssociee.periodeDebut.getTime()) /
            (24 * 60 * 60 * 1000),
        )
      : JOURS_CYCLE_FACTURATION;

    // Préserve le temps restant en cas de renouvellement anticipé (avant
    // l'échéance courante) — même logique que LicenceService#renouveler,
    // désormais alignée ici aussi : un renouvellement ne doit jamais faire
    // perdre les jours déjà payés d'avance.
    const maintenant = new Date();
    const baseFacturation =
      abonnement.dateProchaineFacturation > maintenant
        ? abonnement.dateProchaineFacturation
        : maintenant;
    const dateProchaineFacturation = new Date(baseFacturation);
    dateProchaineFacturation.setDate(dateProchaineFacturation.getDate() + dureeJours);

    await this.prisma.abonnement.update({
      where: { id: abonnement.id },
      data: { statut: StatutAbonnement.ACTIF, dateProchaineFacturation },
    });

    if (factureAssociee) {
      await this.prisma.facture.update({
        where: { id: factureAssociee.id },
        data: { statut: StatutFacture.PAYEE },
      });
    }

    const licence = await this.licenceService.getStatut(tenantId);
    const idempotencyKey = `paiement-reussi:${abonnement.id}:${dateProchaineFacturation.toISOString()}`;

    if (licence.statut === StatutLicence.SUSPENDUE) {
      await this.licenceService.reactiver(
        tenantId,
        ACTEUR_SYSTEME_FACTURATION,
        `${idempotencyKey}:reactivation`,
        'Paiement reçu',
      );
      await this.licenceService.renouveler(
        tenantId,
        ACTEUR_SYSTEME_FACTURATION,
        `${idempotencyKey}:renouvellement`,
        dureeJours,
        'Paiement reçu',
      );
    } else if (licence.statut === StatutLicence.ESSAI || licence.statut === StatutLicence.EXPIREE) {
      await this.licenceService.activer(
        tenantId,
        ACTEUR_SYSTEME_FACTURATION,
        idempotencyKey,
        'Paiement reçu',
      );
    } else {
      await this.licenceService.renouveler(
        tenantId,
        ACTEUR_SYSTEME_FACTURATION,
        idempotencyKey,
        dureeJours,
        'Paiement reçu',
      );
    }
  }

  // Job planifié (voir billing.scheduler.ts) : relance les abonnements en
  // retard, puis suspend la licence au-delà du délai de grâce
  // (JOURS_GRACE_AVANT_SUSPENSION) — §13.3, la transition entre période
  // payée expirée et suspension reste alignée avec ce module.
  async relancerAbonnementsEnRetard(): Promise<void> {
    const enRetard = await this.prisma.abonnement.findMany({
      where: { statut: StatutAbonnement.EN_RETARD },
    });
    const maintenant = new Date();

    for (const abonnement of enRetard) {
      const depuis = maintenant.getTime() - abonnement.updatedAt.getTime();
      const joursDepuis = depuis / (24 * 60 * 60 * 1000);

      if (joursDepuis >= JOURS_GRACE_AVANT_SUSPENSION) {
        await this.licenceService
          .suspendre(
            abonnement.tenantId,
            ACTEUR_SYSTEME_FACTURATION,
            `relance-suspension:${abonnement.id}:${maintenant.toISOString().slice(0, 10)}`,
            `Paiement en retard depuis plus de ${JOURS_GRACE_AVANT_SUSPENSION} jours`,
          )
          .catch((erreur: Error) => {
            // La licence peut déjà être SUSPENDUE (transition refusée,
            // 409) si une action manuelle a eu lieu entre-temps — pas une
            // erreur à faire remonter au job planifié.
            this.logger.warn(
              `Suspension automatique ignorée pour tenant ${abonnement.tenantId} : ${erreur.message}`,
            );
          });
        continue;
      }

      const cleJour = maintenant.toISOString().slice(0, 10);
      const idempotencyKey = `relance:${abonnement.id}:${cleJour}`;
      const dejaRelance = await this.prisma.journalPaiement.findUnique({
        where: { idempotencyKey },
      });
      if (dejaRelance) {
        continue;
      }

      await this.prisma.journalPaiement.create({
        data: {
          tenantId: abonnement.tenantId,
          abonnementId: abonnement.id,
          type: TypeEvenementPaiement.RELANCE_ENVOYEE,
          idempotencyKey,
        },
      });
    }
  }
}
