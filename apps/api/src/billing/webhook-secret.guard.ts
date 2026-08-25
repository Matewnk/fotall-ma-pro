import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Tient lieu de vérification de signature fournisseur (Stripe/Mobile
// Money) en attendant une intégration réelle — aucune credential
// fournisseur n'existe dans ce projet (voir specs/017-billing/spec.md).
// Un secret partagé statique reste une protection réelle contre un appel
// non autorisé, contrairement à un endpoint laissé totalement ouvert.
@Injectable()
export class WebhookSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secretAttendu = this.config.get<string>('FACTURATION_WEBHOOK_SECRET');
    if (!secretAttendu) {
      throw new ForbiddenException('Webhook de facturation non configuré.');
    }

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    const secretRecu = request.headers['x-webhook-secret'];
    if (secretRecu !== secretAttendu) {
      throw new ForbiddenException('Secret de webhook invalide.');
    }

    return true;
  }
}
