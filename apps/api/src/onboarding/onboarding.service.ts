import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChoixCatalogue, EtapeOnboarding, OnboardingState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from '../services/services.service';
import { CompleteStep1Dto } from './dto/complete-step1.dto';
import { CompleteStep2Dto } from './dto/complete-step2.dto';
import { CompleteStep3Dto } from './dto/complete-step3.dto';

const ORDRE: EtapeOnboarding[] = [
  EtapeOnboarding.IDENTITE,
  EtapeOnboarding.TARIFS,
  EtapeOnboarding.UTILISATEUR_NOTIFICATION,
  EtapeOnboarding.TERMINE,
];

function avancer(actuelle: EtapeOnboarding, apres: EtapeOnboarding): EtapeOnboarding {
  return ORDRE.indexOf(apres) > ORDRE.indexOf(actuelle) ? apres : actuelle;
}

// Parcours reprenable : chaque etape peut etre rappelee independamment
// (l'admin peut corriger l'etape 1 apres avoir avance), etape_courante
// n'avance jamais en arriere. Aucun guard ailleurs dans l'app ne depend
// de cet etat : l'onboarding ne bloque jamais l'utilisation normale.
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly servicesService: ServicesService,
  ) {}

  async initier(
    tx: Pick<PrismaService, 'onboardingState'>,
    tenantId: string,
  ): Promise<OnboardingState> {
    return tx.onboardingState.create({ data: { tenantId } });
  }

  async getEtat(tenantId: string): Promise<OnboardingState> {
    return this.findOrThrow(tenantId);
  }

  async completerEtape1(tenantId: string, dto: CompleteStep1Dto): Promise<OnboardingState> {
    const etat = await this.findOrThrow(tenantId);

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.nomPressing !== undefined ? { nomPressing: dto.nomPressing } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.adresse !== undefined ? { adresse: dto.adresse } : {}),
        ...(dto.telephone !== undefined ? { telephone: dto.telephone } : {}),
        ...(dto.devise !== undefined ? { devise: dto.devise } : {}),
        ...(dto.langue !== undefined ? { langue: dto.langue } : {}),
      },
    });

    return this.prisma.onboardingState.update({
      where: { id: etat.id },
      data: {
        identiteCompleteeAt: new Date(),
        etapeCourante: avancer(etat.etapeCourante, EtapeOnboarding.TARIFS),
      },
    });
  }

  async completerEtape2(tenantId: string, dto: CompleteStep2Dto): Promise<OnboardingState> {
    const etat = await this.findOrThrow(tenantId);

    // Idempotent (skipDuplicates sur le code) : rappeler l'étape 2 après
    // correction ne duplique jamais le catalogue.
    if (dto.choix === ChoixCatalogue.CATALOGUE_STANDARD) {
      await this.servicesService.seedCatalogueStandard(tenantId);
    }

    return this.prisma.onboardingState.update({
      where: { id: etat.id },
      data: {
        choixCatalogue: dto.choix,
        tarifsCompletesAt: new Date(),
        etapeCourante: avancer(etat.etapeCourante, EtapeOnboarding.UTILISATEUR_NOTIFICATION),
      },
    });
  }

  async completerEtape3(tenantId: string, dto: CompleteStep3Dto): Promise<OnboardingState> {
    const etat = await this.findOrThrow(tenantId);

    const misAJour = await this.prisma.onboardingState.update({
      where: { id: etat.id },
      data: {
        canalPreference: dto.canalPreference,
        notificationCompleteeAt: new Date(),
        termineAt: new Date(),
        etapeCourante: avancer(etat.etapeCourante, EtapeOnboarding.TERMINE),
      },
    });

    // Point d'integration pour le module Notifications (012) — meme motif
    // que licence.essai.bientot_expire : le domaine metier n'appelle
    // jamais directement un fournisseur (FCM/WhatsApp/SMS).
    this.events.emit('onboarding.notification.test', {
      tenantId,
      canal: dto.canalPreference,
    });

    return misAJour;
  }

  private async findOrThrow(tenantId: string): Promise<OnboardingState> {
    const etat = await this.prisma.onboardingState.findUnique({ where: { tenantId } });
    if (!etat) {
      throw new NotFoundException('Aucun etat onboarding pour ce tenant.');
    }
    return etat;
  }
}
