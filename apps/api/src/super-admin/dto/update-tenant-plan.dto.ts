import { PlanCommercial } from '@prisma/client';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateTenantPlanDto {
  @IsIn(Object.values(PlanCommercial))
  plan!: PlanCommercial;

  // §023-subscriptions-invoicing : si fourni, remplace le montant de
  // l'abonnement en cours (sinon montant inchangé) — jamais un prorata
  // calculé automatiquement, voir spec.md.
  @IsOptional()
  @IsNumber()
  @Min(0)
  nouveauMontant?: number;

  @IsOptional()
  @IsString()
  motif?: string;
}
