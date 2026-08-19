import { Injectable, Logger } from '@nestjs/common';
import { CanalNotification } from '../../generated/tenant-client';
import { NotificationAdapter } from './notification-adapter.interface';

// Aucune credential Firebase Cloud Messaging n'est configuree dans ce
// projet : implementation "log-only" en attendant un branchement reel.
// L'interface (NotificationAdapter) est deja le point d'extension —
// remplacer le corps de envoyer() suffira, aucun appelant n'a a changer.
@Injectable()
export class FcmAdapter implements NotificationAdapter {
  readonly canal = CanalNotification.PUSH;
  private readonly logger = new Logger(FcmAdapter.name);

  async envoyer(destinataire: string, message: string): Promise<void> {
    this.logger.log(`[FCM] -> ${destinataire}: ${message}`);
  }
}
