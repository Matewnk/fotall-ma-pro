import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ICONES_STOCK } from '../icones-stock.constants';

export class UpdateArticleStockDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  intitule?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  unite?: string;

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
