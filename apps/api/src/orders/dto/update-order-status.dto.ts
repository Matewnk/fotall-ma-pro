import { IsIn } from 'class-validator';
import { StatutCommande } from '../../generated/tenant-client';

export class UpdateOrderStatusDto {
  @IsIn(Object.values(StatutCommande))
  statut!: StatutCommande;
}
