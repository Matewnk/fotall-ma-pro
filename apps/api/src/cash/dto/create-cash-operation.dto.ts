import { IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ModePaiement, TypeOperationCaisse } from '../../generated/tenant-client';

export class CreateCashOperationDto {
  @IsIn(Object.values(TypeOperationCaisse))
  type!: TypeOperationCaisse;

  // Optionnel : requis sauf pour un ENCAISSEMENT lié à une commande
  // (commandeId fourni), auquel cas le montant est toujours dérivé du
  // total réel de la commande côté serveur — jamais fourni par
  // l'appelant (§ order-to-cash, "le frontend n'est jamais la source de
  // vérité du montant").
  @IsOptional()
  @IsNumber()
  montant?: number;

  // Réservé au nouveau flux "Encaisser la commande" (order-to-cash) : sa
  // seule présence, combinée à commandeId, déclenche la dérivation stricte
  // du montant depuis le total réel de la commande (cash.service.ts). Sans
  // montantRecu, un ENCAISSEMENT avec commandeId reste un encaissement
  // manuel classique (ex. paiement partiel suivi par le dashboard) — ne
  // pas l'envoyer en dehors de ce flux. Sert aussi à calculer la monnaie
  // à rendre (réponse uniquement, jamais persisté).
  @IsOptional()
  @IsNumber()
  @Min(0)
  montantRecu?: number;

  @IsOptional()
  @IsIn(Object.values(ModePaiement))
  modePaiement?: ModePaiement;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  commandeId?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsString()
  @MinLength(1)
  idempotencyKey!: string;
}
