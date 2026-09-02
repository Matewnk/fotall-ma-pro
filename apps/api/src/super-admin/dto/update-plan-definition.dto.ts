import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// Tous les champs optionnels : le SUPER_ADMIN peut renseigner un plan
// progressivement (ex. le prix d'abord, les limites plus tard) plutôt que
// devoir tout fournir en un seul appel.
export class UpdatePlanDefinitionDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  prixMensuel?: number;

  @IsOptional()
  @IsString()
  devise?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  limiteUtilisateurs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  limitePointsDeService?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fonctionnalites?: string[];
}
