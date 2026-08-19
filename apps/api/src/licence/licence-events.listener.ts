import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

type EssaiBientotExpireEvent = { tenantId: string; licenceId: string; dateFinEssai: Date };

// Point d'intégration pour le module Notifications (012). Pour l'instant,
// se contente de journaliser : aucun fournisseur (FCM/WhatsApp/SMS) n'est
// encore branché, conformément à l'architecture évènementielle du cahier
// des charges §8.3 (le domaine métier n'appelle jamais directement un
// fournisseur).
@Injectable()
export class LicenceEventsListener {
  private readonly logger = new Logger(LicenceEventsListener.name);

  @OnEvent('licence.essai.bientot_expire')
  handleEssaiBientotExpire(payload: EssaiBientotExpireEvent): void {
    this.logger.log(
      `Essai bientôt expiré pour tenant ${payload.tenantId} (fin le ${payload.dateFinEssai.toISOString()})`,
    );
  }
}
