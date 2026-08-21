export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'CAISSIER' | 'TECHNICIEN' | 'LIVREUR';

export type Session = {
  accessToken: string;
  tenant: { id: string; nomPressing: string; sousDomaine: string };
  user: { id: string; email: string; role: Role };
};

export type Client = {
  id: string;
  nom: string;
  telephone: string;
};

export type Service = {
  id: string;
  code: string;
  intitule: string;
  tarif: string;
};

export type StatutCommande = 'EN_ATTENTE' | 'EN_COURS' | 'PRET' | 'LIVRE';
export type ModeLivraison = 'RETRAIT' | 'LIVRAISON';

export type Commande = {
  id: string;
  numero: number;
  clientId: string;
  statut: StatutCommande;
  sousTotal: string;
  total: string;
  modeLivraison: ModeLivraison;
  createdAt: string;
};
