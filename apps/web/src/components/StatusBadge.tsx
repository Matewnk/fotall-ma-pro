import type { StatutCommande } from '../lib/types';

export const LIBELLES_STATUT_COMMANDE: Record<StatutCommande, string> = {
  EN_ATTENTE: 'En attente',
  EN_COURS: 'En cours',
  PRET: 'Terminé',
  LIVRE: 'Livré',
};

const COULEURS: Record<StatutCommande, string> = {
  EN_ATTENTE: 'bg-status-pending/10 text-status-pending',
  EN_COURS: 'bg-status-progress/10 text-status-progress',
  PRET: 'bg-status-ready/10 text-status-ready',
  LIVRE: 'bg-status-delivered/10 text-status-delivered',
};

export function StatusBadge({ statut }: { statut: StatutCommande }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${COULEURS[statut]}`}>
      {LIBELLES_STATUT_COMMANDE[statut]}
    </span>
  );
}
