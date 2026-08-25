import type { StatutCommande } from './types';

// Le serveur refuse toute régression de statut (ConflictException,
// orders.service.ts) : une implémentation réelle doit lever cette
// erreur sur un 409 plutôt qu'une erreur générique, pour que le moteur
// de synchronisation puisse adopter la vérité serveur localement
// (resoudreConflitStatut) au lieu de réessayer indéfiniment.
export class ConflitStatutError extends Error {
  constructor(public readonly statutServeur: StatutCommande) {
    super(`Conflit de statut : le serveur est déjà à ${statutServeur}.`);
    this.name = 'ConflitStatutError';
  }
}

// Contrat minimal vers l'API réelle (REST déjà existante — 009/010/007 —
// aucun nouvel endpoint de synchronisation n'est requis pour cette
// tranche). Une implémentation réelle (HTTP, réutilisant le même schéma
// que apps/web/src/lib/api-client.ts) sera branchée lors de
// l'implémentation des écrans mobiles ; ce contrat permet de tester le
// moteur de synchronisation sans dépendre du réseau.
export interface ApiClient {
  creerCommande(
    payload: {
      clientId: string;
      articles: { serviceId: string; quantite: number }[];
      modeLivraison: string;
      adresseLivraison?: string;
      datePrevue?: string;
      notes?: string;
    },
    idempotencyKey: string,
  ): Promise<{ id: string; numero: number }>;

  mettreAJourStatutCommande(
    commandeServerId: string,
    statut: StatutCommande,
  ): Promise<{ statut: StatutCommande }>;

  creerOperationCaisse(
    payload: {
      type: string;
      montant: string;
      modePaiement?: string;
      reference?: string;
      commandeId?: string;
    },
    idempotencyKey: string,
  ): Promise<{ id: string }>;

  recupererClient(clientServerId: string): Promise<{
    nom: string;
    telephone: string;
    email?: string;
    adresse?: string;
    notes?: string;
    updatedAt: string;
  }>;

  modifierClient(
    clientServerId: string,
    payload: { nom: string; telephone: string; email?: string; adresse?: string; notes?: string },
  ): Promise<{ updatedAt: string }>;
}
