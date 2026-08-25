import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ICONES_SERVICE } from '../icones.constants';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  intitule?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  categorie?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  delaiHeures?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tarif?: number;

  @IsOptional()
  @IsIn(ICONES_SERVICE)
  icone?: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
