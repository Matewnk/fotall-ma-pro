import { StatutTicketSupport } from '@prisma/client';
import { IsIn } from 'class-validator';

export class UpdateSupportTicketStatutDto {
  @IsIn(Object.values(StatutTicketSupport))
  statut!: StatutTicketSupport;
}
