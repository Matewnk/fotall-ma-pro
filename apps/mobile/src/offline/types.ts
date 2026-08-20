// Enveloppe de mutation offline (cahier des charges §18.2) : chaque
// mutation créée hors-ligne porte ces 6 informations. tenant_id vient de
// la session en cours (une base locale appartient à un seul tenant à la
// fois, comme le JWT côté API) plutôt que d'être répété par ligne dans
// le schéma WatermelonDB (voir db/schema.ts).
export type TypeMutation =
  'COMMANDE_CREATION' | 'COMMANDE_STATUT' | 'CAISSE_OPERATION' | 'CLIENT_EDIT';

export interface EnveloppeMutation {
  tenantId: string;
  deviceId: string;
  uuidLocal: string;
  idempotencyKey: string;
  timestampLocal: string;
  type: TypeMutation;
}

// §18.4 : indicateur affiché à l'écran (différé — pas d'écran dans cette
// tranche, mais l'état qui l'alimenterait est déjà exposé par le moteur
// de synchronisation ci-dessous).
export type StatutSynchronisation = 'SYNCHRONISE' | 'EN_ATTENTE' | 'ERREUR';

export const ORDRE_STATUT_COMMANDE = ['EN_ATTENTE', 'EN_COURS', 'PRET', 'LIVRE'] as const;
export type StatutCommande = (typeof ORDRE_STATUT_COMMANDE)[number];
