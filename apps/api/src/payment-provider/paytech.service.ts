import { randomUUID } from 'node:crypto';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type InitiationPaiement = {
  referenceCommande: string;
  montant: number;
  devise: string;
  itemName: string;
};

export type ResultatInitiationPaiement = {
  token: string;
  redirectUrl: string;
  mode: 'DRY_RUN';
};

// Adaptateur PayTech (ADR-007) — même principe que NotificationsService
// (notifications/notifications.service.ts) : point d'entrée unique,
// mode dry-run par défaut (PAYTECH_DRY_RUN, défaut "true"), aucune
// credential PayTech réelle dans ce projet. Seul le mode dry-run est
// implémenté pour l'instant : il ne contacte jamais paytech.sn, il
// simule le contrat documenté (POST /api/payment/request-payment ->
// URL de paiement hébergée) pour permettre de tester le flux
// d'initiation (route, permission, audit) avant d'obtenir des clés
// sandbox réelles. Le mode réel (SANDBOX/LIVE) reste à écrire lors de
// l'intégration effective — voir ADR-007 "Secrets".
@Injectable()
export class PaytechService {
  private readonly logger = new Logger(PaytechService.name);

  constructor(private readonly config: ConfigService) {}

  private get dryRun(): boolean {
    return this.config.get<string>('PAYTECH_DRY_RUN', 'true') !== 'false';
  }

  // Exposé pour permettre au contrôleur de refuser la route de
  // confirmation dev-only (POST .../confirmer-dry-run) dès que
  // PAYTECH_DRY_RUN=false — jamais accessible une fois le vrai PayTech
  // configuré (voir ADR-007).
  estDryRun(): boolean {
    return this.dryRun;
  }

  async initierPaiement(params: InitiationPaiement): Promise<ResultatInitiationPaiement> {
    if (!this.dryRun) {
      // Volontairement non implémenté : aucune clé API/secrète PayTech
      // réelle n'existe dans ce projet (voir ADR-007 "Secrets"). Écrire
      // ce chemin sans pouvoir le tester contre le vrai sandbox
      // produirait un faux sentiment de couverture.
      throw new InternalServerErrorException(
        'Intégration PayTech réelle non implémentée (voir ADR-007). ' +
          'Configurez PAYTECH_DRY_RUN=true pour tester le flux en simulation.',
      );
    }

    const token = randomUUID();
    this.logger.log(
      `[DRY_RUN] Initiation paiement simulée — ref=${params.referenceCommande} ` +
        `montant=${params.montant} ${params.devise}`,
    );

    return {
      token,
      redirectUrl: `https://paytech.sn/dry-run/${token}`,
      mode: 'DRY_RUN',
    };
  }
}
