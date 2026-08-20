import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { WebhookPaiementDto } from './dto/webhook-paiement.dto';
import { WebhookSecretGuard } from './webhook-secret.guard';

// Endpoint public (aucun JWT — un fournisseur de paiement externe ne
// porte pas de session utilisateur), protégé par un secret partagé
// (voir webhook-secret.guard.ts) en attendant une vérification de
// signature fournisseur réelle.
@UseGuards(WebhookSecretGuard)
@Controller('facturation')
export class BillingWebhookController {
  constructor(private readonly billingService: BillingService) {}

  @Post('webhook')
  async webhook(@Body() dto: WebhookPaiementDto): Promise<{ recu: true }> {
    await this.billingService.traiterEvenementPaiement(dto);
    return { recu: true };
  }
}
