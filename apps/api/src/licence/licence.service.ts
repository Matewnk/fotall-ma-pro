import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { EvenementLicence, Licence, StatutLicence } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ALERTE_AVANT_EXPIRATION_HEURES,
  ESSAI_DUREE_JOURS,
  TRANSITIONS,
} from './licence.constants';

type MutationOptions = {
  motif?: string | undefined;
  extra?: Partial<{
    dateActivation: Date;
    dateExpirationCourante: Date;
  }>;
};

@Injectable()
export class LicenceService {
  private readonly logger = new Logger(LicenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly events: EventEmitter2,
  ) {}

  // Appele a la creation du tenant, dans la meme transaction (voir
  // AuthService.register). date_fin_essai = date_debut_essai + 15 jours,
  // calcule ici, cote serveur, jamais fourni par le client.
  async creerEssai(
    tx: Pick<PrismaService, 'licence' | 'journalLicence'>,
    tenantId: string,
    plan: string,
  ): Promise<Licence> {
    const dateDebutEssai = new Date();
    const dateFinEssai = new Date(dateDebutEssai);
    dateFinEssai.setDate(dateFinEssai.getDate() + ESSAI_DUREE_JOURS);

    const licence = await tx.licence.create({
      data: {
        tenantId,
        statut: StatutLicence.ESSAI,
        dateDebutEssai,
        dateFinEssai,
      },
    });

    const licenceSignee = await tx.licence.update({
      where: { id: licence.id },
      data: { cleLicenceJwt: this.signToken(licence, plan) },
    });

    await tx.journalLicence.create({
      data: {
        tenantId,
        licenceId: licence.id,
        evenement: EvenementLicence.CREATION,
      },
    });

    return licenceSignee;
  }

  // Lecture faisant autorite : si l'essai est arrive a echeance mais que le
  // job n'est pas encore passe, la transition EXPIRATION_AUTOMATIQUE est
  // appliquee ici-meme avant de repondre. Jamais l'horloge du client.
  async getStatut(tenantId: string): Promise<Licence> {
    let licence = await this.findByTenantOrThrow(tenantId);
    licence = await this.expireSiEcheance(licence);

    return this.prisma.licence.update({
      where: { id: licence.id },
      data: { derniereVerificationAt: new Date() },
    });
  }

  async activer(tenantId: string, actorUserId: string, idempotencyKey: string, motif?: string) {
    return this.appliquerTransition(
      tenantId,
      EvenementLicence.ACTIVATION,
      actorUserId,
      idempotencyKey,
      {
        motif,
        extra: { dateActivation: new Date() },
      },
    );
  }

  async renouveler(
    tenantId: string,
    actorUserId: string,
    idempotencyKey: string,
    dureeJours: number,
    motif?: string,
  ) {
    const licenceActuelle = await this.findByTenantOrThrow(tenantId);
    const base =
      licenceActuelle.dateExpirationCourante && licenceActuelle.dateExpirationCourante > new Date()
        ? licenceActuelle.dateExpirationCourante
        : new Date();
    const dateExpirationCourante = new Date(base);
    dateExpirationCourante.setDate(dateExpirationCourante.getDate() + dureeJours);

    return this.appliquerTransition(
      tenantId,
      EvenementLicence.RENOUVELLEMENT,
      actorUserId,
      idempotencyKey,
      {
        motif,
        extra: { dateExpirationCourante },
      },
    );
  }

  async suspendre(tenantId: string, actorUserId: string, idempotencyKey: string, motif: string) {
    return this.appliquerTransition(
      tenantId,
      EvenementLicence.SUSPENSION,
      actorUserId,
      idempotencyKey,
      {
        motif,
      },
    );
  }

  async reactiver(tenantId: string, actorUserId: string, idempotencyKey: string, motif?: string) {
    return this.appliquerTransition(
      tenantId,
      EvenementLicence.REACTIVATION,
      actorUserId,
      idempotencyKey,
      {
        motif,
      },
    );
  }

  async revoquer(tenantId: string, actorUserId: string, idempotencyKey: string, motif: string) {
    return this.appliquerTransition(
      tenantId,
      EvenementLicence.REVOCATION,
      actorUserId,
      idempotencyKey,
      {
        motif,
      },
    );
  }

  // Job planifie (voir licence.scheduler.ts) : fait passer tous les essais
  // arrives a echeance en EXPIREE, et emet l'alerte 48h pour les autres.
  async traiterEcheancesEssai(): Promise<void> {
    const maintenant = new Date();
    const dansMoins48h = new Date(
      maintenant.getTime() + ALERTE_AVANT_EXPIRATION_HEURES * 60 * 60 * 1000,
    );

    const essaisArrivesAEcheance = await this.prisma.licence.findMany({
      where: { statut: StatutLicence.ESSAI, dateFinEssai: { lte: maintenant } },
    });
    for (const licence of essaisArrivesAEcheance) {
      await this.expireSiEcheance(licence);
    }

    const essaisBientotExpires = await this.prisma.licence.findMany({
      where: {
        statut: StatutLicence.ESSAI,
        dateFinEssai: { gt: maintenant, lte: dansMoins48h },
        alerte48hEnvoyeeAt: null,
      },
    });
    for (const licence of essaisBientotExpires) {
      this.events.emit('licence.essai.bientot_expire', {
        tenantId: licence.tenantId,
        licenceId: licence.id,
        dateFinEssai: licence.dateFinEssai,
      });
      await this.prisma.licence.update({
        where: { id: licence.id },
        data: { alerte48hEnvoyeeAt: new Date() },
      });
    }
  }

  private async expireSiEcheance(licence: Licence): Promise<Licence> {
    if (licence.statut !== StatutLicence.ESSAI || licence.dateFinEssai > new Date()) {
      return licence;
    }
    // Idempotency key deterministe : plusieurs appels concurrents (job +
    // lecture GET /licence/statut) ne créent jamais deux entrées de journal.
    return this.appliquerTransition(
      licence.tenantId,
      EvenementLicence.EXPIRATION_AUTOMATIQUE,
      undefined,
      `auto-expire:${licence.id}:${licence.dateFinEssai.toISOString()}`,
      {},
    );
  }

  private async appliquerTransition(
    tenantId: string,
    evenement: EvenementLicence,
    actorUserId: string | undefined,
    idempotencyKey: string,
    options: MutationOptions,
  ): Promise<Licence> {
    const licence = await this.findByTenantOrThrow(tenantId);

    const dejaTraite = await this.prisma.journalLicence.findUnique({
      where: {
        licenceId_evenement_idempotencyKey: {
          licenceId: licence.id,
          evenement,
          idempotencyKey,
        },
      },
    });
    if (dejaTraite) {
      this.logger.log(`Rejeu idempotent ignoré : ${evenement} / ${idempotencyKey}`);
      return licence;
    }

    const transition = TRANSITIONS[evenement];
    if (!transition.depuis.includes(licence.statut)) {
      throw new ConflictException(
        `Transition ${evenement} impossible depuis l'état ${licence.statut}.`,
      );
    }

    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const licenceProjetee: Licence = { ...licence, statut: transition.vers, ...options.extra };
    const cleLicenceJwt = this.signToken(licenceProjetee, tenant.plan);

    return this.prisma.$transaction(async (tx) => {
      const licenceFinale = await tx.licence.update({
        where: { id: licence.id },
        data: { statut: transition.vers, ...options.extra, cleLicenceJwt },
      });

      await tx.journalLicence.create({
        data: {
          tenantId,
          licenceId: licence.id,
          evenement,
          effectuePar: actorUserId ?? null,
          motif: options.motif ?? null,
          idempotencyKey,
        },
      });

      return licenceFinale;
    });
  }

  private async findByTenantOrThrow(tenantId: string): Promise<Licence> {
    const licence = await this.prisma.licence.findUnique({ where: { tenantId } });
    if (!licence) {
      throw new NotFoundException('Aucune licence pour ce tenant.');
    }
    return licence;
  }

  // Rotation de la cle a chaque changement d'etat prevu (cahier des
  // charges §13.5). Cle server-side uniquement, jamais un secret de
  // confiance cote client.
  private signToken(licence: Licence, plan: string): string {
    return this.jwt.sign(
      {
        tenantId: licence.tenantId,
        licenceId: licence.id,
        plan,
        statut: licence.statut,
        expiration: licence.dateExpirationCourante ?? licence.dateFinEssai,
      },
      { expiresIn: '30d' },
    );
  }
}
