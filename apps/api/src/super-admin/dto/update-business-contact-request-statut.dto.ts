import { StatutDemandeBusiness } from '@prisma/client';
import { IsIn } from 'class-validator';

export class UpdateBusinessContactRequestStatutDto {
  @IsIn(Object.values(StatutDemandeBusiness))
  statut!: StatutDemandeBusiness;
}
