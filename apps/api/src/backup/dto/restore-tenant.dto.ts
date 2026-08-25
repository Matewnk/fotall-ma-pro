import { Equals, IsString, MinLength } from 'class-validator';

export const CONFIRMATION_RESTAURATION = 'CONFIRMER_RESTAURATION';

// Opération destructive (le schéma existant est supprimé avant d'être
// recréé depuis la sauvegarde, backup.service.ts) : une confirmation
// explicite et exacte est exigée, distincte du simple fait d'appeler
// l'endpoint, pour éviter qu'un appel accidentel ou un rejeu de requête
// ne déclenche une restauration.
export class RestoreTenantDto {
  @IsString()
  @Equals(CONFIRMATION_RESTAURATION)
  confirmation!: string;

  @IsString()
  @MinLength(1)
  dumpBase64!: string;
}
