import { IsIn } from 'class-validator';
import { PlanCommercial } from '@prisma/client';

export class UpdateTenantPlanDto {
  @IsIn(Object.values(PlanCommercial))
  plan!: PlanCommercial;
}
