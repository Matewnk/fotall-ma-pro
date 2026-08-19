import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CanalNotification,
  NotificationLog,
  StatutEnvoiNotification,
  TypeEvenementNotification,
} from '../generated/tenant-client';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';
import { NOTIFICATION_ADAPTERS } from './adapters/notification-adapters.token';
import { NotificationAdapter } from './adapters/notification-adapter.interface';
import { DonneesTemplate, rendreTemplate } from './notification-templates';

const MAX_TENTATIVES = 3;

// Point d'entree unique pour tout envoi (cahier des charges §8.3) : le
// domaine metier emet des evenements internes (voir
// notifications-events.listener.ts), jamais un appel direct a un
// fournisseur. Journal systematique, idempotence par cle deterministe,
// retry borne, et un mode dry-run pour le developpement (aucune credential
// FCM/WhatsApp/SMS reelle n'existe dans ce projet de toute facon).
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly adaptersParCanal: Map<CanalNotification, NotificationAdapter>;

  constructor(
    private readonly tenantPrisma: TenantPrismaFactory,
    private readonly config: ConfigService,
    @Inject(NOTIFICATION_ADAPTERS) adapters: NotificationAdapter[],
  ) {
    this.adaptersParCanal = new Map(adapters.map((adapter) => [adapter.canal, adapter]));
  }

  private get dryRun(): boolean {
    return this.config.get<string>('NOTIFICATIONS_DRY_RUN', 'true') !== 'false';
  }

  async envoyer(
    tenantId: string,
    evenement: TypeEvenementNotification,
    canal: CanalNotification,
    destinataire: string,
    donnees: DonneesTemplate,
    idempotencyKey: string,
  ): Promise<NotificationLog> {
    const client = this.tenantPrisma.forTenant(tenantId);

    const existante = await client.notificationLog.findUnique({ where: { idempotencyKey } });
    if (existante) {
      this.logger.log(`Rejeu idempotent ignoré : notification / ${idempotencyKey}`);
      return existante;
    }

    const message = rendreTemplate(evenement, donnees);

    if (this.dryRun) {
      return client.notificationLog.create({
        data: {
          evenement,
          canal,
          destinataire,
          statut: StatutEnvoiNotification.DRY_RUN,
          idempotencyKey,
        },
      });
    }

    const adapter = this.adaptersParCanal.get(canal);
    if (!adapter) {
      return client.notificationLog.create({
        data: {
          evenement,
          canal,
          destinataire,
          statut: StatutEnvoiNotification.ECHEC,
          erreur: `Aucun adaptateur pour le canal ${canal}`,
          idempotencyKey,
        },
      });
    }

    let derniereErreur: string | undefined;
    for (let tentative = 1; tentative <= MAX_TENTATIVES; tentative++) {
      try {
        await adapter.envoyer(destinataire, message);
        return client.notificationLog.create({
          data: {
            evenement,
            canal,
            destinataire,
            statut: StatutEnvoiNotification.ENVOYE,
            tentatives: tentative,
            idempotencyKey,
          },
        });
      } catch (error) {
        derniereErreur = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Tentative ${tentative}/${MAX_TENTATIVES} échouée (${canal}) : ${derniereErreur}`,
        );
      }
    }

    return client.notificationLog.create({
      data: {
        evenement,
        canal,
        destinataire,
        statut: StatutEnvoiNotification.ECHEC,
        tentatives: MAX_TENTATIVES,
        erreur: derniereErreur ?? null,
        idempotencyKey,
      },
    });
  }
}
