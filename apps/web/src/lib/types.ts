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
export type AbonnementGlobal = {
  id: string;
  tenantId: string;
  nomPressing: string;
  plan: PlanCommercial;
  modePaiement: ModePaiementFacturation;
  montant: number;
  devise: string;
  statut: StatutAbonnement;
  dateProchaineFacturation: string;
  referenceProvider?: string;
  createdAt: string;
};

export type CataloguePlan = {
  plan: PlanCommercial;
  prixMensuel: number | null;
  devise: string;
  limiteUtilisateurs: number | null;
  limitePointsDeService: number | null;
  fonctionnalites: string[];
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
  referenceProvider?: string | null;
  idempotencyKey?: string;
  createdAt: string;
};

// Reflète GET /abonnement, § Renouvellement self-service : licence est la
// source de vérité de la date d'expiration réelle et du statut d'accès
// (ESSAI/ACTIVE/EXPIREE/SUSPENDUE), distincte de Abonnement.statut qui ne
// couvre que l'état de facturation (ACTIF/EN_RETARD/ANNULE) — voir
// BillingService#obtenirFacturation.
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
  licence: {
    statut: StatutLicence;
    dateActivation: string | null;
    dateExpirationCourante: string | null;
  };
  // false tant que PAYTECH_DRY_RUN=false et qu'aucun vrai fournisseur
  // n'est câblé (voir ADR-007) — le bouton de renouvellement doit alors
  // s'effacer au profit d'un message, plutôt que de mener à une erreur.
  paiementEnLigneDisponible: boolean;
};
export const DUREES_RENOUVELLEMENT_MOIS = [1, 3, 6, 12] as const;
export type DureeRenouvellementMois = (typeof DUREES_RENOUVELLEMENT_MOIS)[number];

export type InitiationRenouvellement = {
  factureId: string;
  token: string;
  redirectUrl: string;
  mode: 'DRY_RUN';
  plan: PlanCommercial;
  montant: number;
  devise: string;
  dureeMois: DureeRenouvellementMois;
  dateExpirationActuelle: string;
  nouvelleDateExpiration: string;
};

export type ConfirmationRenouvellement = {
  mode: 'DRY_RUN';
  facture: Facture;
};

export type HistoriqueAbonnementEntry = {
  id: string;
  tenantId: string;
  ancienPlan: PlanCommercial;
  nouveauPlan: PlanCommercial;
  ancienPrix: number | null;
  nouveauPrix: number | null;
  devise: string;
  effectuePar: string;
  motif?: string | null;
  dateEffet: string;
  createdAt: string;
};

export type StatutFacture = 'EMISE' | 'PAYEE' | 'EN_RETARD' | 'ANNULEE';

export type Facture = {
  id: string;
  numero: string;
  tenantId: string;
  nomPressingSnap: string;
  emailProprioSnap?: string | null;
  planSnap: PlanCommercial;
  montant: number;
  devise: string;
  modePaiementSnap: ModePaiementFacturation;
  periodeDebut: string;
  periodeFin: string;
  statut: StatutFacture;
  dateEmission: string;
  dateEcheance: string;
  paiementRefId?: string | null;
  emisePar: string;
};

export type FactureGlobale = Facture & { tenant: { nomPressing: string } };

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
