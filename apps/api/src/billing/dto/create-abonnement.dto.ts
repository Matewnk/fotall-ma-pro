import { ModePaiementFacturation, PlanCommercial } from '@prisma/client';
import { IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateAbonnementDto {
  @IsIn(Object.values(PlanCommercial))
  plan!: PlanCommercial;

  @IsIn(Object.values(ModePaiementFacturation))
  modePaiement!: ModePaiementFacturation;

  @IsNumber()
  @Min(0)
  montant!: number;

  @IsOptional()
  @IsString()
  devise?: string;

  @IsString()
  @MinLength(1)
  dateProchaineFacturation!: string;

  @IsOptional()
  @IsString()
  referenceProvider?: string;
}
