import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ICONES_STOCK } from '../icones-stock.constants';

export class CreateArticleStockDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  intitule!: string;

  // Unité d'affichage libre ("bidons (5L)", "unités", "rouleaux") — pas
  // d'enum : trop variable d'un consommable à l'autre.
  @IsString()
  @MinLength(1)
  unite!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  seuil?: number;

  @IsOptional()
  @IsIn(ICONES_STOCK)
  icone?: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
