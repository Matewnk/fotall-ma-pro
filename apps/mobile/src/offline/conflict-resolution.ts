import { ORDRE_STATUT_COMMANDE, type StatutCommande } from './types';

// §18.3 "Statut commande" : le statut le plus avancé gagne, jamais de
// régression. Duplique intentionnellement la même règle que
// orders.constants.ts côté API (deux runtimes distincts, mobile ne peut
// pas importer le code NestJS) — le serveur reste de toute façon la
// dernière autorité (le PATCH est rejeté en cas de régression), cette
// fonction ne fait que décider quel statut afficher/pousser localement.
export function resoudreConflitStatut(
  statutLocal: StatutCommande,
  statutServeur: StatutCommande,
): StatutCommande {
  const rangLocal = ORDRE_STATUT_COMMANDE.indexOf(statutLocal);
  const rangServeur = ORDRE_STATUT_COMMANDE.indexOf(statutServeur);
  return rangLocal >= rangServeur ? statutLocal : statutServeur;
}

export type ChampClient = 'nom' | 'telephone' | 'email' | 'adresse' | 'notes';

export interface VersionClient {
  nom: string;
  telephone: string;
  email?: string;
  adresse?: string;
  notes?: string;
}

export interface HorodatagesChampsClient {
  nom: Date;
  telephone: Date;
  email?: Date;
  adresse?: Date;
  notes?: Date;
}

// §18.3 "Client" : fusion champ par champ selon le timestamp du champ.
// Le serveur ne connaît pas d'horodatage par champ (une seule colonne
// updated_at par ligne) : on compare l'horodatage de chaque champ local
// à l'horodatage de la ligne serveur dans son ensemble — si le champ
// local a été modifié après la dernière synchronisation connue du
// serveur, la valeur locale gagne ; sinon, la valeur serveur gagne.
export function fusionnerClient(
  local: VersionClient,
  horodatagesLocaux: HorodatagesChampsClient,
  serveur: VersionClient,
  horodatageServeur: Date,
): VersionClient {
  const champs: ChampClient[] = ['nom', 'telephone', 'email', 'adresse', 'notes'];
  const resultat: VersionClient = { nom: local.nom, telephone: local.telephone };

  for (const champ of champs) {
    const horodatageLocal = horodatagesLocaux[champ];
    const valeurLocale = local[champ];
    const valeurServeur = serveur[champ];
    const garderLocal = horodatageLocal !== undefined && horodatageLocal > horodatageServeur;
    const valeurRetenue = garderLocal ? valeurLocale : valeurServeur;
    if (valeurRetenue !== undefined) {
      resultat[champ] = valeurRetenue;
    }
  }

  return resultat;
}

// §18.3 "Commande créée offline" : "pas de conflit métier" — seule une
// réconciliation d'identifiant est nécessaire une fois la création
// acceptée par le serveur.
export function reconcilierIdentifiantCommande<T extends { id?: string }>(
  commandeLocale: T,
  reponseServeur: { id: string; numero: number },
): T & { id: string; numero: number } {
  return { ...commandeLocale, id: reponseServeur.id, numero: reponseServeur.numero };
}

// §18.3 "Caisse" : append-only, aucun écrasement — une opération de
// caisse créée hors-ligne n'a jamais besoin d'être fusionnée ou
// réconciliée avec une version serveur différente, elle est simplement
// ajoutée au journal (idempotencyKey déjà garanti unique côté API,
// 010-cash). Documenté ici plutôt qu'une fonction : il n'y a rien à
// résoudre, contrairement aux trois autres règles ci-dessus.
