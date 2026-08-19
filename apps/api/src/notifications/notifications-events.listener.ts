import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CanalNotification,
  ModeLivraison,
  TypeEvenementNotification,
} from '../generated/tenant-client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';
import { NotificationsService } from './notifications.service';

type CommandeEvent = {
  tenantId: string;
  commandeId: string;
  clientId: string;
  numero: number;
  modeLivraison: ModeLivraison;
};

type EssaiBientotExpireEvent = { tenantId: string; licenceId: string; dateFinEssai: Date };

type OnboardingTestEvent = { tenantId: string; canal: CanalNotification };

// Seul consommateur des évènements émis par Commande (009), Licence (004) et
// Onboarding (006) : ces modules n'appellent jamais un fournisseur
// directement (cahier des charges §8.3). Referme les deux boucles laissées
// en simple journalisation depuis 004/006.
@Injectable()
export class NotificationsEventsListener {
  private readonly logger = new Logger(NotificationsEventsListener.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly tenantPrisma: TenantPrismaFactory,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('commande.creee')
  async handleCommandeCreee(payload: CommandeEvent): Promise<void> {
    await this.notifierClient(payload, TypeEvenementNotification.COMMANDE_CREEE);
  }

  @OnEvent('commande.en_cours')
  async handleCommandeEnCours(payload: CommandeEvent): Promise<void> {
    await this.notifierClient(payload, TypeEvenementNotification.COMMANDE_EN_COURS);
  }

  @OnEvent('commande.prete')
  async handleCommandePrete(payload: CommandeEvent): Promise<void> {
    await this.notifierClient(payload, TypeEvenementNotification.COMMANDE_PRETE);
    // Une commande prête ET en mode livraison déclenche aussi l'annonce de
    // livraison prévue (pas de planification distincte dans ce projet).
    if (payload.modeLivraison === ModeLivraison.LIVRAISON) {
      await this.notifierClient(payload, TypeEvenementNotification.LIVRAISON_PREVUE);
    }
  }

  @OnEvent('commande.livree')
  async handleCommandeLivree(payload: CommandeEvent): Promise<void> {
    await this.notifierClient(payload, TypeEvenementNotification.COMMANDE_LIVREE);
  }

  @OnEvent('licence.essai.bientot_expire')
  async handleEssaiBientotExpire(payload: EssaiBientotExpireEvent): Promise<void> {
    const [tenant, onboarding] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: payload.tenantId } }),
      this.prisma.onboardingState.findUnique({ where: { tenantId: payload.tenantId } }),
    ]);
    if (!tenant?.telephone || !onboarding?.canalPreference) {
      this.logger.warn(
        `Pas de canal/téléphone connu pour tenant ${payload.tenantId}, alerte licence ignorée.`,
      );
      return;
    }

    await this.notifications.envoyer(
      payload.tenantId,
      TypeEvenementNotification.LICENCE_PROCHE_EXPIRATION,
      onboarding.canalPreference,
      tenant.telephone,
      { dateFinEssai: payload.dateFinEssai.toISOString().slice(0, 10) },
      `LICENCE_PROCHE_EXPIRATION:${payload.licenceId}`,
    );
  }

  @OnEvent('onboarding.notification.test')
  async handleOnboardingTest(payload: OnboardingTestEvent): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: payload.tenantId } });
    if (!tenant?.telephone) {
      this.logger.warn(
        `Pas de téléphone connu pour tenant ${payload.tenantId}, test de canal ignoré.`,
      );
      return;
    }

    await this.notifications.envoyer(
      payload.tenantId,
      TypeEvenementNotification.TEST_CANAL,
      payload.canal,
      tenant.telephone,
      { nomPressing: tenant.nomPressing },
      `TEST_CANAL:${payload.tenantId}`,
    );
  }

  private async notifierClient(
    payload: CommandeEvent,
    evenement: TypeEvenementNotification,
  ): Promise<void> {
    const [tenant, client] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: payload.tenantId } }),
      this.tenantPrisma
        .forTenant(payload.tenantId)
        .client.findUnique({ where: { id: payload.clientId } }),
    ]);
    if (!tenant || !client) {
      this.logger.warn(
        `Client ou tenant introuvable pour la commande ${payload.commandeId}, notification ignorée.`,
      );
      return;
    }

    await this.notifications.envoyer(
      payload.tenantId,
      evenement,
      client.canalNotification ?? CanalNotification.SMS,
      client.telephone,
      { numero: payload.numero, nomPressing: tenant.nomPressing },
      `${evenement}:${payload.commandeId}`,
    );
  }
}
