import { StatutCommande } from '../generated/tenant-client';

// EN_ATTENTE < EN_COURS < PRET < LIVRE (cahier des charges §6.3). Toute
// transition vers un index inferieur ou egal est refusee (409) —
// interdiction stricte de regression, y compris rester sur place via cet
// endpoint (le statut ne se "confirme" pas, il avance).
export const ORDRE_STATUT_COMMANDE: StatutCommande[] = [
  StatutCommande.EN_ATTENTE,
  StatutCommande.EN_COURS,
  StatutCommande.PRET,
  StatutCommande.LIVRE,
];

export function estProgression(actuel: StatutCommande, suivant: StatutCommande): boolean {
  return ORDRE_STATUT_COMMANDE.indexOf(suivant) > ORDRE_STATUT_COMMANDE.indexOf(actuel);
}
