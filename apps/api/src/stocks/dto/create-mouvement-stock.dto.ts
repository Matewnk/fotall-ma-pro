import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { TypeMouvementStock } from '../../generated/tenant-client';

export class CreateMouvementStockDto {
  @IsIn(Object.values(TypeMouvementStock))
  type!: TypeMouvementStock;

  // Toujours une valeur strictement positive quel que soit le type : le
  // signe réel (ENTREE +, SORTIE -, AJUSTEMENT libre selon la direction
  // choisie) est déterminé côté serveur (stocks.service.ts), jamais
  // fourni directement par l'appelant.
  @IsInt()
  @Min(1)
  quantite!: number;

  // Pour AJUSTEMENT uniquement : direction de la correction. Ignoré pour
  // ENTREE/SORTIE (direction déjà fixée par le type).
  @IsOptional()
  @IsIn(['HAUSSE', 'BAISSE'])
  direction?: 'HAUSSE' | 'BAISSE';

  @IsOptional()
  @IsString()
  note?: string;

  @IsString()
  @MinLength(1)
  idempotencyKey!: string;
}
