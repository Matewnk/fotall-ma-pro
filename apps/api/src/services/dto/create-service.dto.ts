import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { ICONES_SERVICE } from '../icones.constants';

export class CreateServiceDto {
  @IsString()
  @Matches(/^[A-Z]{3}-\d{2,}$/, {
    message: 'code doit suivre le format XXX-00 (ex: SRV-01, LIV-01)',
  })
  code!: string;

  @IsString()
  @MinLength(1)
  intitule!: string;

  @IsString()
  @MinLength(1)
  categorie!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  delaiHeures?: number;

  // Validation tarif (test explicite du cahier des charges) : jamais négatif.
  @IsNumber()
  @Min(0)
  tarif!: number;

  @IsOptional()
  @IsIn(ICONES_SERVICE)
  icone?: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
