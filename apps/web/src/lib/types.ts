import type { Role } from '@fotall/shared-types';

export type Session = {
  accessToken: string;
  // Absent uniquement pour une session SUPER_ADMIN (aucun tenant
  // associé) — voir auth-context.tsx#loginSuperAdmin.
  tenant?: { id: string; nomPressing: string; sousDomaine: string };
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
  icone?: string;
  actif: boolean;
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
export type ModePaiement =
  'ESPECES' | 'CARTE' | 'MOBILE_MONEY' | 'WAVE' | 'ORANGE_MONEY' | 'DJAMON' | 'AUTRE';

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

export type TypeMouvementStock = 'ENTREE' | 'SORTIE' | 'AJUSTEMENT';

export type ArticleStock = {
  id: string;
  code: string;
  intitule: string;
  unite: string;
  seuil: number;
  icone?: string;
  actif: boolean;
  quantite: number;
  enAlerte: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MouvementStock = {
  id: string;
  articleId: string;
  type: TypeMouvementStock;
  quantite: number;
  note?: string;
  operateurId: string;
  createdAt: string;
  article: { code: string; intitule: string; unite: string };
};

export type TenantSettings = {
  id: string;
  nomPressing: string;
  sousDomaine: string;
  adresse?: string;
  telephone?: string;
  logoUrl?: string;
  langue: string;
  devise: string;
  fuseauHoraire: string;
};

export type PlanCommercial = 'STARTER' | 'PRO' | 'BUSINESS';
export type StatutLicence = 'ESSAI' | 'ACTIVE' | 'EXPIREE' | 'SUSPENDUE';

export type TenantListe = {
  id: string;
  nomPressing: string;
  sousDomaine: string;
  plan: PlanCommercial;
  createdAt: string;
  licence: {
    statut: StatutLicence;
    dateFinEssai: string;
    dateExpirationCourante?: string;
  } | null;
};

export type TenantDetail = {
  id: string;
  nomPressing: string;
  sousDomaine: string;
  plan: PlanCommercial;
  langue: string;
  devise: string;
  fuseauHoraire: string;
  createdAt: string;
  licence: {
    statut: StatutLicence;
    dateDebutEssai: string;
    dateFinEssai: string;
    dateActivation?: string;
    dateExpirationCourante?: string;
  } | null;
};

export type EntreeAudit = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type SessionSupport = {
  id: string;
  tenantId: string;
  superAdminId: string;
  motif: string;
  startedAt: string;
  endedAt?: string;
};

export type ModePaiementFacturation = 'CARTE' | 'MOBILE_MONEY' | 'VIREMENT';
export type StatutAbonnement = 'ACTIF' | 'EN_RETARD' | 'ANNULE';

export type JournalPaiementEntry = {
  id: string;
  type: string;
  montant?: string;
  devise?: string;
  createdAt: string;
};

export type Abonnement = {
  id: string;
  tenantId: string;
  plan: PlanCommercial;
  modePaiement: ModePaiementFacturation;
  montant: string;
  devise: string;
  statut: StatutAbonnement;
  dateProchaineFacturation: string;
  referenceProvider?: string;
  journal: JournalPaiementEntry[];
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
