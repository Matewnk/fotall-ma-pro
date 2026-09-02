import { IsIn } from 'class-validator';

// Durées proposées explicitement par la mission — jamais une durée libre
// envoyée par le client (le montant est de toute façon toujours recalculé
// côté serveur, voir InvoicesService#creerPourRenouvellementTenant).
export const DUREES_RENOUVELLEMENT_MOIS = [1, 3, 6, 12] as const;

export class RenouvelerAbonnementDto {
  @IsIn(DUREES_RENOUVELLEMENT_MOIS)
  dureeMois!: (typeof DUREES_RENOUVELLEMENT_MOIS)[number];
}
