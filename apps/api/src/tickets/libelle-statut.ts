import { StatutCommande } from '../generated/tenant-client';

// Traduction d'affichage uniquement (PDF/ESC-POS) : TicketData.statut reste
// la valeur brute de l'enum (contrat JSON stable pour /ticket/data, consommé
// par le mobile) — jamais traduite à la source.
const LIBELLES_STATUT: Record<StatutCommande, string> = {
  EN_ATTENTE: 'En attente',
  EN_COURS: 'En cours',
  PRET: 'Terminé',
  LIVRE: 'Livré',
};

export function libelleStatut(statut: string): string {
  return LIBELLES_STATUT[statut as StatutCommande] ?? statut;
}
