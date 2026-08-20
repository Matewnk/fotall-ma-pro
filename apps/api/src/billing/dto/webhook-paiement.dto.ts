import { IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

// Forme normalisée, indépendante du fournisseur (aucune credential
// Stripe/Mobile Money réelle dans ce projet — voir
// specs/017-billing/spec.md). Une intégration réelle traduirait le
// payload propre au fournisseur vers cette même forme avant d'appeler
// BillingService.traiterEvenementPaiement.
const TYPES_EVENEMENT_WEBHOOK = ['PAIEMENT_REUSSI', 'PAIEMENT_ECHEC'] as const;

export class WebhookPaiementDto {
  @IsString()
  @MinLength(1)
  tenantId!: string;

  @IsIn(TYPES_EVENEMENT_WEBHOOK)
  type!: (typeof TYPES_EVENEMENT_WEBHOOK)[number];

  // Identifiant d'évènement fourni par le fournisseur de paiement — garantit
  // l'idempotence d'un rejeu de webhook (§14.1 : "événements de paiement
  // idempotents").
  @IsString()
  @MinLength(1)
  idempotencyKey!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  montant?: number;

  @IsOptional()
  @IsString()
  devise?: string;

  @IsOptional()
  @IsString()
  referenceProvider?: string;
}
