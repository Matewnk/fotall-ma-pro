export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'CAISSIER' | 'TECHNICIEN' | 'LIVREUR';

export type Session = {
  accessToken: string;
  tenant: { id: string; nomPressing: string; sousDomaine: string };
  user: { id: string; email: string; role: Role };
};

export type CanalNotification = 'PUSH' | 'WHATSAPP' | 'SMS';
export type StatutClient = 'ACTIF' | 'INACTIF';

export type Client = {
  id: string;
  nom: string;
  telephone: string;
  email?: string;
  adresse?: string;
  canalNotification?: CanalNotification;
  statut?: StatutClient;
  notes?: string;
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

// Miroir de apps/api/src/tickets/ticket-data.ts (TicketData) — consommé
// par DeliverySlipScreen.tsx (bon de livraison, LIVREUR) via
// GET /commandes/:id/ticket/data.
export type TicketData = {
  numero: number;
  estProvisoire: boolean;
  nomPressing: string;
  adresseTenant: string | null;
  telephoneTenant: string | null;
  logoUrl: string | null;
  client: { nom: string; telephone: string };
  articles: { intitule: string; quantite: number; tarifUnitaire: string; sousTotal: string }[];
  sousTotal: string;
  remise: string;
  total: string;
  datePrevue: string | null;
  modeLivraison: string;
  adresseLivraison: string | null;
  statut: string;
};

export type TypeOperationCaisse =
  | 'OUVERTURE'
  | 'ENCAISSEMENT'
  | 'AVANCE'
  | 'DEPENSE'
  | 'REMBOURSEMENT'
  | 'AJUSTEMENT_COMPENSATOIRE'
  | 'CLOTURE';
export type ModePaiement = 'ESPECES' | 'CARTE' | 'MOBILE_MONEY' | 'WAVE' | 'ORANGE_MONEY' | 'AUTRE';

export type Dashboard = {
  kpis: {
    commandesDuJour: number;
    chiffreAffairesDuJour: string;
    articlesEnAttente: number;
    livraisonsPrevuesAujourdHui: number;
    commandesEnRetard: number;
    revenus7DerniersJours: { date: string; total: string }[];
  };
  commandesRecentes: {
    numero: number;
    client: { id: string; nom: string };
    date: string;
    montant: string;
    statut: StatutCommande;
  }[];
  alertes: {
    commandesUrgentes: number;
    retards: number;
    paiementsEnAttente: number;
    livraisonsDuJour: number;
    erreursSynchronisation: number;
    licenceProcheExpiration: { active: boolean; joursRestants: number | null };
  };
};

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
