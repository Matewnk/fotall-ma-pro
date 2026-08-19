import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CanalNotification } from '@prisma/client';

type NotificationTestEvent = { tenantId: string; canal: CanalNotification };

// Point d'integration pour le module Notifications (012), meme motif que
// LicenceEventsListener : le domaine metier n'appelle jamais directement
// un fournisseur (FCM/WhatsApp/SMS).
@Injectable()
export class OnboardingEventsListener {
  private readonly logger = new Logger(OnboardingEventsListener.name);

  @OnEvent('onboarding.notification.test')
  handleNotificationTest(payload: NotificationTestEvent): void {
    this.logger.log(
      `Test de notification demandé pour tenant ${payload.tenantId} via ${payload.canal}`,
    );
  }
}
