import { StatutFacture } from '@prisma/client';
import { IsIn } from 'class-validator';

// EMISE n'est jamais une cible : c'est le statut initial, jamais un retour
// possible (une facture émise ne "redevient" pas brouillon). EN_RETARD
// n'est pas une cible non plus : calculé à la lecture (échéance dépassée
// sans paiement), jamais écrit — voir invoices.service.ts#statutEffectif.
const STATUTS_CIBLES_AUTORISES = [StatutFacture.PAYEE, StatutFacture.ANNULEE];

export class UpdateInvoiceStatutDto {
  @IsIn(STATUTS_CIBLES_AUTORISES)
  statut!: (typeof STATUTS_CIBLES_AUTORISES)[number];
}
