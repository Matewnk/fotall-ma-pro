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

export type CommandeArticle = {
  id: string;
  serviceId: string;
  quantite: number;
  tarifUnitaire: string;
  sousTotal: string;
};

export type Commande = {
  id: string;
  numero: number;
  clientId: string;
  statut: StatutCommande;
  sousTotal: string;
  total: string;
  modeLivraison: ModeLivraison;
  articles?: CommandeArticle[];
  createdAt: string;
};

export type TypeOperationCaisse =
  | 'OUVERTURE'
  | 'ENCAISSEMENT'
  | 'AVANCE'
  | 'DEPENSE'
  | 'REMBOURSEMENT'
  | 'AJUSTEMENT_COMPENSATOIRE'
  | 'CLOTURE';
export type ModePaiement = 'ESPECES' | 'CARTE' | 'MOBILE_MONEY' | 'AUTRE';

export type OperationCaisse = {
  id: string;
  type: TypeOperationCaisse;
  montant: string;
  modePaiement?: ModePaiement;
  reference?: string;
  commandeId?: string;
  clientId?: string;
  createdAt: string;
};
