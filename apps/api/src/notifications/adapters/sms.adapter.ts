import { Injectable, Logger } from '@nestjs/common';
import { CanalNotification } from '../../generated/tenant-client';
import { NotificationAdapter } from './notification-adapter.interface';

// Aucun fournisseur SMS n'est configure : implementation "log-only" en
// attendant un branchement reel (meme motif que FcmAdapter).
@Injectable()
export class SmsAdapter implements NotificationAdapter {
  readonly canal = CanalNotification.SMS;
  private readonly logger = new Logger(SmsAdapter.name);

  async envoyer(destinataire: string, message: string): Promise<void> {
    this.logger.log(`[SMS] -> ${destinataire}: ${message}`);
  }
}
