import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutFacture } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { JOURS_CYCLE_FACTURATION } from '../billing/billing.constants';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceData } from './invoice-data';

const NUMERO_SEQ_LONGUEUR = 4;

function ajouterJours(date: Date, jours: number): Date {
  return new Date(date.getTime() + jours * 24 * 60 * 60 * 1000);
}

// EN_RETARD n'est jamais écrit en base : calculé ici à chaque lecture
// (échéance dépassée sans paiement) — voir dto/update-invoice-statut.dto.ts.
// montant est converti en nombre (même convention que StatsService/
// BillingService#listerFacturationGlobale) : ce champ n'est jamais
// retransmis tel quel côté frontend, contrairement à Abonnement.montant qui
// reste une chaîne "à la Prisma" ailleurs dans l'API.
function serialiser<
  T extends { montant: Prisma.Decimal; statut: StatutFacture; dateEcheance: Date },
>(facture: T): Omit<T, 'montant'> & { montant: number } {
  const maintenant = new Date();
  const statutEffectif =
    facture.statut === StatutFacture.EMISE && facture.dateEcheance < maintenant
      ? StatutFacture.EN_RETARD
      : facture.statut;
  return { ...facture, montant: facture.montant.toNumber(), statut: statutEffectif };
}

// §023-subscriptions-invoicing : une facture fige (snapshot) l'identité du
// tenant/abonnement au moment de l'émission — jamais une lecture live de
// Tenant/Abonnement pour ces champs-là (voir spec.md). Adresse/téléphone/
// logo restent lus en direct au moment du PDF : ce sont des coordonnées de
// contact, pas des faits financiers à figer.
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async genererNumero(annee: number): Promise<string> {
    const prefixe = `FAC-${annee}-`;
    const compte = await this.prisma.facture.count({
      where: { numero: { startsWith: prefixe } },
    });
    return `${prefixe}${String(compte + 1).padStart(NUMERO_SEQ_LONGUEUR, '0')}`;
  }

  // Pas de prorata (voir spec.md) : periodeFin = date de prochaine
  // facturation de l'abonnement au moment de la génération, periodeDebut =
  // periodeFin - JOURS_CYCLE_FACTURATION (même constante que le cycle de
  // facturation déjà utilisé par BillingService, 017-billing) — jamais une
  // seconde définition du cycle mensuel.
  async creerPourTenant(tenantId: string, emisePar: string) {
    const abonnement = await this.prisma.abonnement.findUnique({ where: { tenantId } });
    if (!abonnement) {
      throw new NotFoundException('Aucun abonnement pour ce tenant.');
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        nomPressing: true,
        sousDomaine: true,
        users: {
          where: { role: 'ADMIN' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { email: true },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant introuvable.');
    }

    const periodeFin = abonnement.dateProchaineFacturation;
    const periodeDebut = ajouterJours(periodeFin, -JOURS_CYCLE_FACTURATION);

    const paiementCorrespondant = await this.prisma.journalPaiement.findFirst({
      where: {
        abonnementId: abonnement.id,
        type: 'PAIEMENT_REUSSI',
        createdAt: { gte: periodeDebut },
      },
      orderBy: { createdAt: 'desc' },
    });

    const numero = await this.genererNumero(periodeFin.getUTCFullYear());

    try {
      const facture = await this.prisma.facture.create({
        data: {
          numero,
          tenantId,
          nomPressingSnap: tenant.nomPressing,
          emailProprioSnap: tenant.users[0]?.email ?? null,
          planSnap: abonnement.plan,
          montant: abonnement.montant,
          devise: abonnement.devise,
          modePaiementSnap: abonnement.modePaiement,
          periodeDebut,
          periodeFin,
          statut: paiementCorrespondant ? StatutFacture.PAYEE : StatutFacture.EMISE,
          dateEcheance: periodeFin,
          ...(paiementCorrespondant ? { paiementRefId: paiementCorrespondant.id } : {}),
          emisePar,
        },
      });
      // Phase 12 : action sensible auditable — utilisateur/action/tenant/
      // date/résultat, même mécanisme que TENANT_PLAN_MODIFIE
      // (tenants.controller.ts), jamais un second système d'audit.
      await this.auditService.create(tenantId, emisePar, {
        action: 'FACTURE_CREEE',
        entityType: 'Facture',
        entityId: facture.id,
        metadata: { numero: facture.numero, montant: facture.montant.toNumber() },
      });
      return serialiser(facture);
    } catch (erreur) {
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
        throw new ConflictException(
          'Une facture existe déjà pour cette période — pas de double génération.',
        );
      }
      throw erreur;
    }
  }

  // §Renouvellement self-service : variante tenant-scoped de
  // creerPourTenant, durée choisie par l'ADMIN (1/3/6/12 mois) au lieu du
  // cycle fixe. Le montant n'est JAMAIS accepté du client : recalculé ici
  // à partir du prix mensuel déjà en vigueur sur l'Abonnement du tenant
  // (même source que creerPourTenant — jamais PlanDefinition, qui reste un
  // catalogue de référence, pas le prix contractuel réel du tenant). La
  // facture est créée EMISE : elle sert d'ancre au paiement PayTech
  // (referenceCommande = facture.id) et n'est marquée PAYEE qu'à la
  // confirmation (voir BillingService#traiterPaiementReussi).
  async creerPourRenouvellementTenant(tenantId: string, dureeMois: number, emisePar: string) {
    const abonnement = await this.prisma.abonnement.findUnique({ where: { tenantId } });
    if (!abonnement) {
      throw new NotFoundException('Aucun abonnement pour ce tenant.');
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        nomPressing: true,
        users: {
          where: { role: 'ADMIN' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { email: true },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant introuvable.');
    }

    const maintenant = new Date();
    const periodeDebut =
      abonnement.dateProchaineFacturation > maintenant
        ? abonnement.dateProchaineFacturation
        : maintenant;
    const periodeFin = ajouterJours(periodeDebut, dureeMois * JOURS_CYCLE_FACTURATION);
    const montant = abonnement.montant.mul(dureeMois);

    const numero = await this.genererNumero(periodeFin.getUTCFullYear());

    try {
      const facture = await this.prisma.facture.create({
        data: {
          numero,
          tenantId,
          nomPressingSnap: tenant.nomPressing,
          emailProprioSnap: tenant.users[0]?.email ?? null,
          planSnap: abonnement.plan,
          montant,
          devise: abonnement.devise,
          modePaiementSnap: abonnement.modePaiement,
          periodeDebut,
          periodeFin,
          statut: StatutFacture.EMISE,
          dateEcheance: periodeFin,
          emisePar,
        },
      });
      await this.auditService.create(tenantId, emisePar, {
        action: 'FACTURE_CREEE',
        entityType: 'Facture',
        entityId: facture.id,
        metadata: {
          numero: facture.numero,
          montant: facture.montant.toNumber(),
          dureeMois,
          contexte: 'renouvellement-self-service',
        },
      });
      return serialiser(facture);
    } catch (erreur) {
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
        throw new ConflictException(
          'Une facture est déjà en attente pour cette période — réessayez dans un instant ou consultez vos factures.',
        );
      }
      throw erreur;
    }
  }

  async listerPourTenant(tenantId: string) {
    const factures = await this.prisma.facture.findMany({
      where: { tenantId },
      orderBy: { dateEmission: 'desc' },
    });
    return factures.map(serialiser);
  }

  async listerGlobale(filtres: {
    tenantId?: string | undefined;
    plan?: string | undefined;
    statut?: StatutFacture | undefined;
    depuis?: Date | undefined;
    jusqua?: Date | undefined;
  }) {
    const factures = await this.prisma.facture.findMany({
      where: {
        ...(filtres.tenantId ? { tenantId: filtres.tenantId } : {}),
        ...(filtres.plan ? { planSnap: filtres.plan as never } : {}),
        ...(filtres.statut ? { statut: filtres.statut } : {}),
        ...(filtres.depuis || filtres.jusqua
          ? {
              dateEmission: {
                ...(filtres.depuis ? { gte: filtres.depuis } : {}),
                ...(filtres.jusqua ? { lte: filtres.jusqua } : {}),
              },
            }
          : {}),
      },
      include: { tenant: { select: { nomPressing: true } } },
      orderBy: { dateEmission: 'desc' },
    });
    return factures.map(serialiser);
  }

  async detail(id: string) {
    const facture = await this.prisma.facture.findUnique({
      where: { id },
      include: { tenant: { select: { nomPressing: true, sousDomaine: true } } },
    });
    if (!facture) {
      throw new NotFoundException();
    }
    return serialiser(facture);
  }

  async detailPourTenant(tenantId: string, id: string) {
    const facture = await this.prisma.facture.findUnique({ where: { id } });
    if (!facture || facture.tenantId !== tenantId) {
      throw new NotFoundException();
    }
    return serialiser(facture);
  }

  // ANNULEE est un état terminal (jamais de retour) ; PAYEE ne peut venir
  // que d'EMISE — jamais re-marquer payée une facture déjà annulée. Aucune
  // suppression : la facture reste consultable après annulation
  // (traçabilité, cohérent avec l'esprit append-only de la facturation).
  async changerStatut(id: string, statut: StatutFacture, actorId: string) {
    const existante = await this.prisma.facture.findUnique({ where: { id } });
    if (!existante) {
      throw new NotFoundException();
    }
    if (existante.statut === StatutFacture.ANNULEE) {
      throw new ConflictException('Une facture annulée ne peut plus changer de statut.');
    }
    const facture = await this.prisma.facture.update({ where: { id }, data: { statut } });
    await this.auditService.create(existante.tenantId, actorId, {
      action: 'FACTURE_STATUT_MODIFIE',
      entityType: 'Facture',
      entityId: facture.id,
      metadata: { ancienStatut: existante.statut, nouveauStatut: statut },
    });
    return serialiser(facture);
  }

  async donneesPourPdf(id: string): Promise<InvoiceData> {
    const facture = await this.prisma.facture.findUnique({
      where: { id },
      include: {
        tenant: { select: { adresse: true, telephone: true, logoUrl: true, sousDomaine: true } },
      },
    });
    if (!facture) {
      throw new NotFoundException();
    }
    // Référence du paiement associé (JournalPaiement.referenceProvider),
    // jamais un second enregistrement — simple lecture si déjà lié.
    const paiement = facture.paiementRefId
      ? await this.prisma.journalPaiement.findUnique({ where: { id: facture.paiementRefId } })
      : null;
    const maintenant = new Date();
    const statutEffectif =
      facture.statut === StatutFacture.EMISE && facture.dateEcheance < maintenant
        ? StatutFacture.EN_RETARD
        : facture.statut;

    return {
      numero: facture.numero,
      dateEmission: facture.dateEmission,
      dateEcheance: facture.dateEcheance,
      nomPressing: facture.nomPressingSnap,
      tenantId: facture.tenantId,
      sousDomaine: facture.tenant.sousDomaine,
      emailProprietaire: facture.emailProprioSnap,
      adresseTenant: facture.tenant.adresse,
      telephoneTenant: facture.tenant.telephone,
      logoUrl: facture.tenant.logoUrl,
      plan: facture.planSnap,
      periodeDebut: facture.periodeDebut,
      periodeFin: facture.periodeFin,
      montant: facture.montant.toNumber(),
      devise: facture.devise,
      modePaiement: facture.modePaiementSnap,
      statut: statutEffectif,
      referencePaiement: paiement?.referenceProvider ?? paiement?.idempotencyKey ?? null,
    };
  }
}
