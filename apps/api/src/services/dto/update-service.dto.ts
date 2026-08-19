import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

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
  @IsBoolean()
  actif?: boolean;
}
