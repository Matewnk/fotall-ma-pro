import { Injectable, Logger } from '@nestjs/common';
import { CanalNotification } from '../../generated/tenant-client';
import { NotificationAdapter } from './notification-adapter.interface';

// Aucune credential WhatsApp Business API n'est configuree : implementation
// "log-only" en attendant un branchement reel (meme motif que FcmAdapter).
@Injectable()
export class WhatsAppAdapter implements NotificationAdapter {
  readonly canal = CanalNotification.WHATSAPP;
  private readonly logger = new Logger(WhatsAppAdapter.name);

  async envoyer(destinataire: string, message: string): Promise<void> {
    this.logger.log(`[WhatsApp] -> ${destinataire}: ${message}`);
  }
}
