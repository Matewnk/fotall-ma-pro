import type { Role } from '@fotall/shared-types';

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
  statut: StatutClient;
  notes?: string;
};

export type Service = {
  id: string;
  code: string;
  intitule: string;
  categorie: string;
  delaiHeures?: number;
  tarif: string;
  actif: boolean;
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
