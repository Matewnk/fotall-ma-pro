import { IsIn } from 'class-validator';

export const PLANS = ['STARTER', 'PRO', 'BUSINESS'] as const;

export class UpdateTenantPlanDto {
  @IsIn(PLANS)
  plan!: (typeof PLANS)[number];
}
