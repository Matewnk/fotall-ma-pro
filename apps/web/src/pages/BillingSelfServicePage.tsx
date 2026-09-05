import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { apiFetch, apiFetchBlob, ApiError } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { declencherTelechargement, ouvrirBlobDansNouvelOnglet } from '../lib/download';
import {
  DUREES_RENOUVELLEMENT_MOIS,
  type Abonnement,
  type ActiviteBusiness,
  type CataloguePlan,
  type ConfirmationRenouvellement,
  type DemandeBusiness,
  type DureeRenouvellementMois,
  type Facture,
  type InitiationRenouvellement,
  type TypeDemandeBusiness,
} from '../lib/types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LIBELLES_ACTIVITE_BUSINESS: Record<ActiviteBusiness, string> = {
  PRESSING_BLANCHISSERIE: 'Pressing / Blanchisserie',
  LAVAGE_AUTO: 'Lavage auto',
  PRESSING_LAVAGE_AUTO: 'Pressing + Lavage auto',
  AUTRE: 'Autre',
};

const LIBELLES_TYPE_DEMANDE_BUSINESS: Record<TypeDemandeBusiness, string> = {
  DEVIS: 'Demander un devis',
  INFORMATIONS: 'Demander des informations',
  DEMONSTRATION: 'Demander une démonstration',
  ACCOMPAGNEMENT: 'Demander un accompagnement',
  AUTRE: 'Autre',
};

type FormulaireContactBusiness = {
  nomComplet: string;
  entreprise: string;
  email: string;
  telephone: string;
  typeActivite: ActiviteBusiness | '';
  nombrePointsDeService: string;
  typeDemande: TypeDemandeBusiness | '';
  message: string;
};

const FORMULAIRE_CONTACT_VIDE: FormulaireContactBusiness = {
  nomComplet: '',
  entreprise: '',
  email: '',
  telephone: '',
  typeActivite: '',
  nombrePointsDeService: '',
  typeDemande: '',
  message: '',
};

const LIBELLES_PLAN: Record<string, string> = {
  STARTER: 'Starter',
  PRO: 'Pro',
  BUSINESS: 'Business',
};

const LIBELLES_STATUT_FACTURE: Record<string, string> = {
  EMISE: 'En attente',
  PAYEE: 'Payée',
  EN_RETARD: 'Impayée',
  ANNULEE: 'Annulée',
};

const COULEURS_STATUT_FACTURE: Record<string, string> = {
  EMISE: 'bg-status-pending/10 text-status-pending',
  PAYEE: 'bg-status-ready/10 text-status-ready',
  EN_RETARD: 'bg-error/10 text-error',
  ANNULEE: 'bg-surface-container-high text-on-surface-variant',
};

// Le journal de paiements ne connaît que 3 types réels (voir
// TypeEvenementPaiement côté API) — pas de concept de remboursement dans
// le modèle actuel. "Impayé" est donc un état dérivé du statut EN_RETARD/
// EMISE de la facture correspondante, jamais un 4ᵉ filtre "Remboursés"
// inventé sans donnée derrière.
const LIBELLES_EVENEMENT: Record<string, string> = {
  PAIEMENT_REUSSI: 'Payé',
  PAIEMENT_ECHEC: 'Impayé',
  RELANCE_ENVOYEE: 'Relance envoyée',
};

const COULEURS_EVENEMENT: Record<string, string> = {
  PAIEMENT_REUSSI: 'bg-status-ready/10 text-status-ready',
  PAIEMENT_ECHEC: 'bg-error/10 text-error',
  RELANCE_ENVOYEE: 'bg-status-pending/10 text-status-pending',
};

function formaterMontant(montant: number | string, devise: string): string {
  const nombre = typeof montant === 'string' ? Number(montant) : montant;
  return `${new Intl.NumberFormat('fr-FR').format(nombre)} ${devise}`;
}

function formaterDate(dateIso: string | null): string {
  if (!dateIso) return '—';
  return new Date(dateIso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function joursRestants(dateIso: string): number {
  return Math.ceil((new Date(dateIso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

// Même convention que côté serveur (JOURS_CYCLE_FACTURATION,
// apps/api/src/billing/billing.constants.ts) : 1 mois = 30 jours, jamais
// une seconde définition du cycle.
const JOURS_PAR_MOIS = 30;

function calculerNouvelleEcheance(depuisIso: string, dureeMois: number): Date {
  const base = new Date(depuisIso);
  const maintenant = new Date();
  const point = base > maintenant ? base : maintenant;
  point.setDate(point.getDate() + dureeMois * JOURS_PAR_MOIS);
  return point;
}

// Date d'expiration réelle de l'abonnement : Licence.dateExpirationCourante
// est la source de vérité de l'accès (voir BillingService#obtenirFacturation,
// ADR-006/ADR-007) — dateProchaineFacturation n'est qu'un repère de
// facturation, utilisé seulement en repli si la licence n'a encore aucune
// échéance connue.
function dateExpirationEffective(a: Abonnement): string {
  return a.licence.dateExpirationCourante ?? a.dateProchaineFacturation;
}

type StatutMerge = 'ACTIF' | 'EXPIRE' | 'SUSPENDU' | 'ANNULE';

// Fusionne Abonnement.statut (facturation) et Licence.statut (accès réel) —
// aucun des deux modèles ne porte seul les 4 états demandés (voir l'audit :
// ANNULE vient d'Abonnement, EXPIRE/SUSPENDU viennent de Licence). Jamais
// un 5ᵉ statut inventé : ESSAI reste théorique une fois un abonnement payé
// créé, traité ici comme ACTIF par défaut plutôt qu'un état à part.
function statutMerge(a: Abonnement): StatutMerge {
  if (a.statut === 'ANNULE') return 'ANNULE';
  if (a.licence.statut === 'SUSPENDUE') return 'SUSPENDU';
  if (a.licence.statut === 'EXPIREE') return 'EXPIRE';
  return 'ACTIF';
}

const LIBELLES_STATUT_MERGE: Record<StatutMerge, string> = {
  ACTIF: 'Actif',
  EXPIRE: 'Expiré',
  SUSPENDU: 'Suspendu',
  ANNULE: 'Annulé',
};

const EMOJI_STATUT_MERGE: Record<StatutMerge, string> = {
  ACTIF: '🟢',
  EXPIRE: '🔴',
  SUSPENDU: '🔴',
  ANNULE: '⚫',
};

const COULEURS_STATUT_MERGE: Record<StatutMerge, string> = {
  ACTIF: 'bg-status-ready/10 text-status-ready',
  EXPIRE: 'bg-error/10 text-error',
  SUSPENDU: 'bg-error/10 text-error',
  ANNULE: 'bg-surface-container-high text-on-surface-variant',
};

type NiveauEcheance = 'NORMAL' | 'PROCHE' | 'EXPIRE';

function niveauEcheance(a: Abonnement): NiveauEcheance {
  const merge = statutMerge(a);
  if (merge !== 'ACTIF') return 'EXPIRE';
  if (joursRestants(dateExpirationEffective(a)) <= 7) return 'PROCHE';
  return 'NORMAL';
}

type EtapeModal = 'CHOIX_DUREE' | 'EN_COURS' | 'SUCCES' | 'ERREUR';

// Écran §023-subscriptions-invoicing — espace propriétaire. Renouvellement
// self-service (ADR-007) : le montant et la période sont toujours calculés
// côté serveur (voir POST /abonnement/renouvellement), jamais fournis par
// ce composant. La confirmation DRY_RUN (POST
// /factures/:id/confirmer-dry-run) est déclenchée automatiquement à la
// suite de l'initiation tant qu'aucun vrai fournisseur PayTech n'est
// configuré — toujours annoncée explicitement comme un mode test.
export function BillingSelfServicePage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();

  const [filtrePaiement, setFiltrePaiement] = useState<'TOUS' | 'PAYES' | 'IMPAYES'>('TOUS');
  const [filtreFacture, setFiltreFacture] = useState<
    'TOUTES' | 'PAYEES' | 'IMPAYEES' | 'EN_ATTENTE'
  >('TOUTES');
  const [factureEnCours, setFactureEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const [modalOuverte, setModalOuverte] = useState(false);
  const [etapeModal, setEtapeModal] = useState<EtapeModal>('CHOIX_DUREE');
  const [dureeChoisie, setDureeChoisie] = useState<DureeRenouvellementMois>(1);
  const [erreurModal, setErreurModal] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationRenouvellement | null>(null);

  const [modalContactOuverte, setModalContactOuverte] = useState(false);
  const [etapeContact, setEtapeContact] = useState<'FORMULAIRE' | 'SUCCES'>('FORMULAIRE');
  const [formContact, setFormContact] =
    useState<FormulaireContactBusiness>(FORMULAIRE_CONTACT_VIDE);
  const [erreursContact, setErreursContact] = useState<Record<string, string>>({});
  const [erreurEnvoiContact, setErreurEnvoiContact] = useState<string | null>(null);

  const abonnement = useQuery({
    queryKey: ['mon-abonnement'],
    queryFn: () => apiFetch<Abonnement>('/abonnement', { token }),
    retry: false,
  });
  const aucunAbonnement = abonnement.error instanceof ApiError && abonnement.error.status === 404;

  const factures = useQuery({
    queryKey: ['mes-factures'],
    queryFn: () => apiFetch<Facture[]>('/factures', { token }),
  });

  const plans = useQuery({
    queryKey: ['catalogue-plans'],
    queryFn: () => apiFetch<CataloguePlan[]>('/plans', { token }),
  });

  const planActuel = useMemo(
    () => plans.data?.find((p) => p.plan === abonnement.data?.plan),
    [plans.data, abonnement.data],
  );

  const confirmer = useMutation({
    mutationFn: (factureId: string) =>
      apiFetch<ConfirmationRenouvellement>(`/factures/${factureId}/confirmer-dry-run`, {
        method: 'POST',
        token,
      }),
    onSuccess: (resultat) => {
      setConfirmation(resultat);
      setEtapeModal('SUCCES');
      queryClient.invalidateQueries({ queryKey: ['mon-abonnement'] });
      queryClient.invalidateQueries({ queryKey: ['mes-factures'] });
    },
    onError: (e) => {
      setErreurModal(e instanceof ApiError ? e.message : 'La confirmation a échoué.');
      setEtapeModal('ERREUR');
    },
  });

  const initier = useMutation({
    mutationFn: (dureeMois: DureeRenouvellementMois) =>
      apiFetch<InitiationRenouvellement>('/abonnement/renouvellement', {
        method: 'POST',
        body: { dureeMois },
        token,
      }),
    onSuccess: (resultat) => {
      if (resultat.mode === 'DRY_RUN') {
        confirmer.mutate(resultat.factureId);
      }
    },
    onError: (e) => {
      setErreurModal(e instanceof ApiError ? e.message : "L'initiation du paiement a échoué.");
      setEtapeModal('ERREUR');
    },
  });

  function ouvrirModal() {
    setDureeChoisie(1);
    setEtapeModal('CHOIX_DUREE');
    setErreurModal(null);
    setConfirmation(null);
    setModalOuverte(true);
  }

  function fermerModal() {
    setModalOuverte(false);
  }

  function handleContinuerVersPaiement() {
    setEtapeModal('EN_COURS');
    setErreurModal(null);
    initier.mutate(dureeChoisie);
  }

  // Public (aucun guard côté API — voir business-contact-requests.controller.ts) :
  // fonctionne pour un visiteur anonyme comme pour un tenant connecté.
  // tenantId n'est envoyé que s'il existe déjà côté session — purement
  // informatif pour le SUPER_ADMIN, jamais une preuve d'appartenance.
  const envoyerContact = useMutation({
    mutationFn: () =>
      apiFetch<DemandeBusiness>('/demandes-business', {
        method: 'POST',
        ...(token ? { token } : {}),
        body: {
          nomComplet: formContact.nomComplet.trim(),
          entreprise: formContact.entreprise.trim(),
          email: formContact.email.trim(),
          telephone: formContact.telephone.trim(),
          typeActivite: formContact.typeActivite,
          typeDemande: formContact.typeDemande,
          message: formContact.message.trim(),
          ...(formContact.nombrePointsDeService
            ? { nombrePointsDeService: Number(formContact.nombrePointsDeService) }
            : {}),
          ...(session?.tenant?.id ? { tenantId: session.tenant.id } : {}),
        },
      }),
    onSuccess: () => setEtapeContact('SUCCES'),
    onError: () => {
      // Jamais de détail technique affiché (§11/§12 de la demande) : un
      // seul message générique, que l'échec vienne du réseau ou de l'API.
      setErreurEnvoiContact(
        'Impossible d’envoyer votre demande pour le moment. Vérifiez votre connexion et réessayez.',
      );
    },
  });

  function ouvrirModalContact() {
    setFormContact(FORMULAIRE_CONTACT_VIDE);
    setErreursContact({});
    setErreurEnvoiContact(null);
    setEtapeContact('FORMULAIRE');
    setModalContactOuverte(true);
  }

  function fermerModalContact() {
    setModalContactOuverte(false);
  }

  function validerFormulaireContact(): Record<string, string> {
    const erreurs: Record<string, string> = {};
    if (!formContact.nomComplet.trim()) erreurs.nomComplet = 'Le nom est obligatoire.';
    if (!formContact.entreprise.trim()) {
      erreurs.entreprise = "Le nom de l'entreprise est obligatoire.";
    }
    if (!formContact.email.trim()) {
      erreurs.email = "L'adresse email est obligatoire.";
    } else if (!EMAIL_REGEX.test(formContact.email.trim())) {
      erreurs.email = 'Veuillez saisir une adresse email valide.';
    }
    if (!formContact.telephone.trim()) {
      erreurs.telephone = 'Le numéro de téléphone est obligatoire.';
    }
    if (!formContact.typeActivite) erreurs.typeActivite = 'Veuillez sélectionner votre activité.';
    if (!formContact.typeDemande) erreurs.typeDemande = 'Veuillez préciser votre demande.';
    if (!formContact.message.trim()) erreurs.message = 'Veuillez décrire votre besoin.';
    if (formContact.nombrePointsDeService && Number(formContact.nombrePointsDeService) < 1) {
      erreurs.nombrePointsDeService = 'Le nombre de points de service doit être au moins 1.';
    }
    return erreurs;
  }

  function handleSubmitContact(event: FormEvent) {
    event.preventDefault();
    const erreurs = validerFormulaireContact();
    setErreursContact(erreurs);
    if (Object.keys(erreurs).length > 0) {
      return;
    }
    setErreurEnvoiContact(null);
    envoyerContact.mutate();
  }

  // Escape ferme la modale (§1 de la demande) — seule modale du fichier
  // à l'exiger explicitement, donc pas de hook partagé avec le modal de
  // renouvellement existant.
  useEffect(() => {
    if (!modalContactOuverte) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') fermerModalContact();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalContactOuverte]);

  const paiementsAffiches = useMemo(() => {
    const journal = abonnement.data?.journal ?? [];
    if (filtrePaiement === 'PAYES') return journal.filter((p) => p.type === 'PAIEMENT_REUSSI');
    if (filtrePaiement === 'IMPAYES') return journal.filter((p) => p.type === 'PAIEMENT_ECHEC');
    return journal;
  }, [abonnement.data, filtrePaiement]);

  const facturesAffichees = useMemo(() => {
    const liste = factures.data ?? [];
    if (filtreFacture === 'PAYEES') return liste.filter((f) => f.statut === 'PAYEE');
    if (filtreFacture === 'IMPAYEES') return liste.filter((f) => f.statut === 'EN_RETARD');
    if (filtreFacture === 'EN_ATTENTE') return liste.filter((f) => f.statut === 'EMISE');
    return liste;
  }, [factures.data, filtreFacture]);

  function factureAssocieeAuPaiement(paiementId: string): Facture | undefined {
    return factures.data?.find((f) => f.paiementRefId === paiementId);
  }

  async function handleVoirFacture(factureId: string) {
    setFactureEnCours(factureId);
    setErreur(null);
    try {
      const blob = await apiFetchBlob(`/factures/${factureId}/pdf`, { token });
      ouvrirBlobDansNouvelOnglet(blob);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Ouverture impossible.');
    } finally {
      setFactureEnCours(null);
    }
  }

  async function handleTelechargerFacture(facture: Facture) {
    setFactureEnCours(facture.id);
    setErreur(null);
    try {
      const blob = await apiFetchBlob(`/factures/${facture.id}/pdf`, { token });
      declencherTelechargement(blob, `${facture.numero}.pdf`);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Téléchargement impossible.');
    } finally {
      setFactureEnCours(null);
    }
  }

  const niveau = abonnement.data ? niveauEcheance(abonnement.data) : null;
  const merge = abonnement.data ? statutMerge(abonnement.data) : null;

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-on-background">Abonnement &amp; facturation</h1>
        <p className="text-sm text-on-surface-variant">
          Consultez votre abonnement, vos paiements et vos factures — et renouvelez en toute
          sécurité.
        </p>
      </div>

      {erreur && <p className="text-sm text-error">{erreur}</p>}

      {abonnement.isPending && <p className="text-sm text-on-surface-variant">Chargement…</p>}

      {abonnement.isError && !aucunAbonnement && (
        <div className="bg-error/5 border border-error/30 rounded-xl p-6 text-center">
          <p className="text-sm text-error">
            {abonnement.error instanceof ApiError
              ? abonnement.error.message
              : 'Impossible de charger votre abonnement pour le moment.'}
          </p>
        </div>
      )}

      {aucunAbonnement && (
        <div className="bg-surface border border-outline-variant rounded-xl p-6 text-center">
          <p className="text-sm text-on-surface-variant">
            Aucun abonnement n'est encore associé à votre pressing. Contactez le support pour
            démarrer.
          </p>
        </div>
      )}

      {abonnement.data && merge && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="bg-surface border border-outline-variant rounded-xl p-5 flex flex-col gap-3">
            <h2 className="font-semibold text-on-background">Mon abonnement</h2>
            <p className="text-lg font-bold text-on-background">
              Plan {LIBELLES_PLAN[abonnement.data.plan] ?? abonnement.data.plan}
            </p>
            <span
              className={`self-start inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${COULEURS_STATUT_MERGE[merge]}`}
            >
              {EMOJI_STATUT_MERGE[merge]} {LIBELLES_STATUT_MERGE[merge]}
            </span>
            {abonnement.data.statut === 'EN_RETARD' && (
              <span className="self-start inline-flex items-center gap-1.5 rounded-full bg-status-pending/10 text-status-pending px-3 py-1 text-xs font-medium">
                🟠 Paiement en retard
              </span>
            )}
            <p className="text-2xl font-bold font-mono text-on-background">
              {formaterMontant(abonnement.data.montant, abonnement.data.devise)}{' '}
              <span className="text-sm font-normal text-on-surface-variant">/ mois</span>
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm mt-1">
              <dt className="text-on-surface-variant">Date de début</dt>
              <dd className="text-right text-on-background">
                {formaterDate(abonnement.data.licence.dateActivation)}
              </dd>
              <dt className="text-on-surface-variant">Date d'expiration</dt>
              <dd className="text-right text-on-background">
                {formaterDate(dateExpirationEffective(abonnement.data))}
              </dd>
              <dt className="text-on-surface-variant">Jours restants</dt>
              <dd className="text-right text-on-background">
                {merge === 'ACTIF'
                  ? Math.max(0, joursRestants(dateExpirationEffective(abonnement.data)))
                  : 0}
              </dd>
              <dt className="text-on-surface-variant">Utilisateurs autorisés</dt>
              <dd className="text-right text-on-background">
                {planActuel?.limiteUtilisateurs ?? '—'}
              </dd>
              <dt className="text-on-surface-variant">Points de service autorisés</dt>
              <dd className="text-right text-on-background">
                {planActuel?.limitePointsDeService ?? '—'}
              </dd>
            </dl>
          </section>

          <section className="bg-surface border border-outline-variant rounded-xl p-5 flex flex-col gap-3">
            <h2 className="font-semibold text-on-background">Prochain paiement</h2>
            {abonnement.data.statut === 'ANNULE' ? (
              <p className="text-sm text-on-surface-variant">
                Votre abonnement n'a aucun paiement programmé.
              </p>
            ) : (
              <>
                <p className="text-2xl font-bold font-mono text-on-background">
                  {formaterMontant(abonnement.data.montant, abonnement.data.devise)}
                </p>
                <p className="text-sm text-on-surface-variant">
                  Plan {LIBELLES_PLAN[abonnement.data.plan] ?? abonnement.data.plan} — Date :{' '}
                  {formaterDate(abonnement.data.dateProchaineFacturation)}
                </p>
              </>
            )}

            {niveau === 'PROCHE' && (
              <div className="rounded-lg border border-status-pending/40 bg-status-pending/10 px-3 py-2 text-sm text-status-pending">
                Votre abonnement expire dans{' '}
                {joursRestants(dateExpirationEffective(abonnement.data))} jours.
              </div>
            )}
            {niveau === 'EXPIRE' && (
              <div className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
                {merge === 'ANNULE'
                  ? 'Votre abonnement est annulé.'
                  : 'Votre abonnement est expiré.'}
              </div>
            )}

            {merge !== 'ANNULE' && abonnement.data.paiementEnLigneDisponible && (
              <button
                type="button"
                onClick={ouvrirModal}
                className="self-start px-4 py-2 rounded-lg text-sm font-medium bg-primary text-on-primary"
              >
                🔄{' '}
                {niveau === 'EXPIRE'
                  ? 'Réactiver mon abonnement'
                  : niveau === 'PROCHE'
                    ? 'Renouveler maintenant'
                    : 'Renouveler mon abonnement'}
              </button>
            )}
            {merge !== 'ANNULE' && !abonnement.data.paiementEnLigneDisponible && (
              <p className="text-xs text-on-surface-variant">
                Renouvellement en ligne bientôt disponible. Contactez le support pour renouveler
                votre abonnement.
              </p>
            )}
          </section>
        </div>
      )}

      {modalOuverte && abonnement.data && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={fermerModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-modal-renouvellement"
            className="w-full max-w-md rounded-xl border border-outline-variant bg-surface p-6 shadow-xl flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {etapeModal === 'CHOIX_DUREE' && (
              <>
                <h2
                  id="titre-modal-renouvellement"
                  className="text-lg font-bold text-on-background"
                >
                  Choisissez votre durée
                </h2>
                <div className="grid grid-cols-4 gap-2">
                  {DUREES_RENOUVELLEMENT_MOIS.map((duree) => (
                    <button
                      key={duree}
                      type="button"
                      onClick={() => setDureeChoisie(duree)}
                      className={`rounded-lg px-2 py-2 text-sm font-medium border ${
                        dureeChoisie === duree
                          ? 'border-primary bg-primary-container/20 text-primary'
                          : 'border-outline-variant text-on-surface-variant'
                      }`}
                    >
                      {duree} mois
                    </button>
                  ))}
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-on-surface-variant">Plan actuel</dt>
                  <dd className="text-right font-medium text-on-background">
                    {LIBELLES_PLAN[abonnement.data.plan] ?? abonnement.data.plan}
                  </dd>
                  <dt className="text-on-surface-variant">Durée</dt>
                  <dd className="text-right font-medium text-on-background">{dureeChoisie} mois</dd>
                  <dt className="text-on-surface-variant">Prix</dt>
                  <dd className="text-right font-mono font-medium text-on-background">
                    {formaterMontant(
                      Number(abonnement.data.montant) * dureeChoisie,
                      abonnement.data.devise,
                    )}
                  </dd>
                  <dt className="text-on-surface-variant">Expiration actuelle</dt>
                  <dd className="text-right font-medium text-on-background">
                    {formaterDate(dateExpirationEffective(abonnement.data))}
                  </dd>
                  <dt className="text-on-surface-variant">Nouvelle expiration</dt>
                  <dd className="text-right font-medium text-on-background">
                    {formaterDate(
                      calculerNouvelleEcheance(
                        dateExpirationEffective(abonnement.data),
                        dureeChoisie,
                      ).toISOString(),
                    )}
                  </dd>
                </dl>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={fermerModal}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleContinuerVersPaiement}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary"
                  >
                    Continuer vers le paiement
                  </button>
                </div>
              </>
            )}

            {etapeModal === 'EN_COURS' && (
              <>
                <h2 className="text-lg font-bold text-on-background">Paiement en cours…</h2>
                <p className="rounded-lg bg-status-pending/10 text-status-pending p-3 text-xs font-medium">
                  🧪 Mode TEST — aucun paiement réel n'est effectué.
                </p>
                <p className="text-sm text-on-surface-variant">
                  Un instant, nous confirmons votre renouvellement.
                </p>
              </>
            )}

            {etapeModal === 'ERREUR' && (
              <>
                <h2 className="text-lg font-bold text-on-background">Le renouvellement a échoué</h2>
                <p className="text-sm text-error">{erreurModal}</p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={fermerModal}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
                  >
                    Fermer
                  </button>
                  <button
                    type="button"
                    onClick={() => setEtapeModal('CHOIX_DUREE')}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary"
                  >
                    Réessayer
                  </button>
                </div>
              </>
            )}

            {etapeModal === 'SUCCES' && confirmation && (
              <>
                <p className="rounded-lg bg-status-pending/10 text-status-pending p-2 text-xs font-medium text-center">
                  🧪 Mode TEST — simulation PayTech, aucun paiement réel.
                </p>
                <h2 className="text-lg font-bold text-on-background">
                  Votre abonnement a été renouvelé avec succès.
                </h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-on-surface-variant">Plan</dt>
                  <dd className="text-right font-medium text-on-background">
                    {LIBELLES_PLAN[confirmation.facture.planSnap] ?? confirmation.facture.planSnap}
                  </dd>
                  <dt className="text-on-surface-variant">Montant payé</dt>
                  <dd className="text-right font-mono font-medium text-on-background">
                    {formaterMontant(confirmation.facture.montant, confirmation.facture.devise)}
                  </dd>
                  <dt className="text-on-surface-variant">Nouvelle date d'expiration</dt>
                  <dd className="text-right font-medium text-on-background">
                    {formaterDate(confirmation.facture.periodeFin)}
                  </dd>
                </dl>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={fermerModal}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
                  >
                    Retour à mon abonnement
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVoirFacture(confirmation.facture.id)}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary"
                  >
                    Voir ma facture
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {abonnement.data && (
        <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-outline-variant">
            <h2 className="font-semibold text-on-background">Historique des paiements</h2>
            <div className="flex gap-1">
              {(['TOUS', 'PAYES', 'IMPAYES'] as const).map((valeur) => (
                <button
                  key={valeur}
                  type="button"
                  onClick={() => setFiltrePaiement(valeur)}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    filtrePaiement === valeur
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {valeur === 'TOUS' ? 'Tous' : valeur === 'PAYES' ? 'Payés' : 'Impayés'}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-on-surface-variant">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Référence</th>
                  <th className="px-4 py-2">Montant</th>
                  <th className="px-4 py-2">Moyen</th>
                  <th className="px-4 py-2">Statut</th>
                  <th className="px-4 py-2">Facture associée</th>
                </tr>
              </thead>
              <tbody>
                {paiementsAffiches.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-on-surface-variant" colSpan={6}>
                      Aucun paiement pour l'instant.
                    </td>
                  </tr>
                )}
                {paiementsAffiches.map((paiement) => {
                  const factureAssociee = factureAssocieeAuPaiement(paiement.id);
                  return (
                    <tr key={paiement.id} className="border-t border-outline-variant">
                      <td className="px-4 py-2 text-on-surface-variant">
                        {new Date(paiement.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-on-surface-variant">
                        {paiement.referenceProvider ?? paiement.idempotencyKey ?? '—'}
                      </td>
                      <td className="px-4 py-2 font-mono">
                        {paiement.montant
                          ? formaterMontant(paiement.montant, paiement.devise ?? 'XOF')
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-on-surface-variant">
                        {abonnement.data?.modePaiement ?? '—'}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${COULEURS_EVENEMENT[paiement.type] ?? ''}`}
                        >
                          {LIBELLES_EVENEMENT[paiement.type] ?? paiement.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-on-surface-variant">
                        {factureAssociee?.numero ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-outline-variant">
          <h2 className="font-semibold text-on-background">Mes factures</h2>
          <div className="flex gap-1">
            {(['TOUTES', 'PAYEES', 'IMPAYEES', 'EN_ATTENTE'] as const).map((valeur) => (
              <button
                key={valeur}
                type="button"
                onClick={() => setFiltreFacture(valeur)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  filtreFacture === valeur
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {valeur === 'TOUTES'
                  ? 'Toutes'
                  : valeur === 'PAYEES'
                    ? 'Payées'
                    : valeur === 'IMPAYEES'
                      ? 'Impayées'
                      : 'En attente'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-on-surface-variant">
                <th className="px-4 py-2">Numéro</th>
                <th className="px-4 py-2">Période</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Montant</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {factures.isPending && (
                <tr>
                  <td className="px-4 py-4 text-on-surface-variant" colSpan={6}>
                    Chargement…
                  </td>
                </tr>
              )}
              {factures.isError && (
                <tr>
                  <td className="px-4 py-4 text-error" colSpan={6}>
                    Impossible de charger vos factures pour le moment.
                  </td>
                </tr>
              )}
              {!factures.isPending && !factures.isError && facturesAffichees.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-on-surface-variant" colSpan={6}>
                    Aucune facture pour l'instant.
                  </td>
                </tr>
              )}
              {facturesAffichees.map((facture) => (
                <tr key={facture.id} className="border-t border-outline-variant">
                  <td className="px-4 py-2 font-mono text-xs">{facture.numero}</td>
                  <td className="px-4 py-2 text-on-surface-variant">
                    {new Date(facture.periodeFin).toLocaleDateString('fr-FR', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-2 text-on-surface-variant">
                    {new Date(facture.dateEmission).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-2 font-mono">
                    {formaterMontant(facture.montant, facture.devise)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${COULEURS_STATUT_FACTURE[facture.statut]}`}
                    >
                      {LIBELLES_STATUT_FACTURE[facture.statut]}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-primary text-xs font-medium disabled:opacity-60"
                        disabled={factureEnCours === facture.id}
                        onClick={() => handleVoirFacture(facture.id)}
                      >
                        Voir
                      </button>
                      <button
                        type="button"
                        className="text-primary text-xs font-medium disabled:opacity-60"
                        disabled={factureEnCours === facture.id}
                        onClick={() => handleTelechargerFacture(facture)}
                      >
                        Télécharger
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-surface border border-outline-variant rounded-xl p-5">
        <h2 className="font-semibold text-on-background mb-4">Plans disponibles</h2>
        {plans.isPending && <p className="text-sm text-on-surface-variant">Chargement…</p>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.data?.map((plan) =>
            plan.plan === 'BUSINESS' ? (
              <div
                key={plan.plan}
                className="border border-outline-variant rounded-xl p-4 flex flex-col gap-2"
              >
                <h3 className="font-bold text-on-background">Business</h3>
                <p className="text-xs text-on-surface-variant">Pour les grands réseaux.</p>
                <p className="text-lg font-bold text-on-background">Sur mesure</p>
                <ul className="text-xs text-on-surface-variant flex flex-col gap-0.5 mt-1">
                  <li>✓ Agences illimitées</li>
                  <li>✓ API &amp; intégrations</li>
                  <li>✓ Support prioritaire</li>
                </ul>
                <button
                  type="button"
                  onClick={ouvrirModalContact}
                  className="mt-2 rounded-lg px-4 py-2 text-sm font-medium bg-primary text-on-primary"
                >
                  Nous contacter
                </button>
              </div>
            ) : (
              <div
                key={plan.plan}
                className={`border rounded-xl p-4 flex flex-col gap-2 ${
                  abonnement.data?.plan === plan.plan
                    ? 'border-primary bg-primary-container/10'
                    : 'border-outline-variant'
                }`}
              >
                <h3 className="font-bold text-on-background">
                  {LIBELLES_PLAN[plan.plan] ?? plan.plan}
                </h3>
                <p className="text-lg font-bold text-on-background">
                  {plan.prixMensuel !== null
                    ? `${formaterMontant(plan.prixMensuel, plan.devise)} / mois`
                    : 'Non configuré'}
                </p>
                <p className="text-xs text-on-surface-variant">
                  Utilisateurs max : {plan.limiteUtilisateurs ?? '—'}
                </p>
                <p className="text-xs text-on-surface-variant">
                  Points de service max : {plan.limitePointsDeService ?? '—'}
                </p>
                {plan.fonctionnalites.length > 0 && (
                  <ul className="text-xs text-on-surface-variant flex flex-col gap-0.5 mt-1">
                    {plan.fonctionnalites.map((f) => (
                      <li key={f}>✓ {f}</li>
                    ))}
                  </ul>
                )}
              </div>
            ),
          )}
        </div>
        <p className="text-xs text-on-surface-variant mt-4">
          Pour changer de plan, contactez le support.
        </p>
      </section>

      {modalContactOuverte && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 overflow-y-auto"
          onClick={fermerModalContact}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-modal-contact-business"
            className="w-full max-w-xl rounded-xl border border-outline-variant bg-surface p-6 shadow-xl flex flex-col gap-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {etapeContact === 'FORMULAIRE' && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2
                      id="titre-modal-contact-business"
                      className="text-lg font-bold text-on-background"
                    >
                      Parlons de votre projet
                    </h2>
                    <p className="text-sm text-on-surface-variant mt-1">
                      Décrivez-nous vos besoins et notre équipe vous contactera pour vous proposer
                      une solution adaptée.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fermerModalContact}
                    aria-label="Fermer"
                    className="shrink-0 rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-high"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <form onSubmit={handleSubmitContact} className="flex flex-col gap-4" noValidate>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1 text-sm">
                      Nom complet *
                      <input
                        className="border border-outline-variant rounded-lg px-3 py-2"
                        value={formContact.nomComplet}
                        onChange={(e) =>
                          setFormContact({ ...formContact, nomComplet: e.target.value })
                        }
                      />
                      {erreursContact.nomComplet && (
                        <span className="text-xs text-error">{erreursContact.nomComplet}</span>
                      )}
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Nom de l'entreprise / pressing *
                      <input
                        className="border border-outline-variant rounded-lg px-3 py-2"
                        placeholder="Exemple : Pressing Lumière"
                        value={formContact.entreprise}
                        onChange={(e) =>
                          setFormContact({ ...formContact, entreprise: e.target.value })
                        }
                      />
                      {erreursContact.entreprise && (
                        <span className="text-xs text-error">{erreursContact.entreprise}</span>
                      )}
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Adresse email *
                      <input
                        type="email"
                        className="border border-outline-variant rounded-lg px-3 py-2"
                        value={formContact.email}
                        onChange={(e) => setFormContact({ ...formContact, email: e.target.value })}
                      />
                      {erreursContact.email && (
                        <span className="text-xs text-error">{erreursContact.email}</span>
                      )}
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Téléphone / WhatsApp *
                      <input
                        className="border border-outline-variant rounded-lg px-3 py-2"
                        value={formContact.telephone}
                        onChange={(e) =>
                          setFormContact({ ...formContact, telephone: e.target.value })
                        }
                      />
                      {erreursContact.telephone && (
                        <span className="text-xs text-error">{erreursContact.telephone}</span>
                      )}
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Type d'activité *
                      <select
                        className="border border-outline-variant rounded-lg px-3 py-2 bg-surface"
                        value={formContact.typeActivite}
                        onChange={(e) =>
                          setFormContact({
                            ...formContact,
                            typeActivite: e.target.value as ActiviteBusiness,
                          })
                        }
                      >
                        <option value="">Sélectionner…</option>
                        {Object.entries(LIBELLES_ACTIVITE_BUSINESS).map(([valeur, libelle]) => (
                          <option key={valeur} value={valeur}>
                            {libelle}
                          </option>
                        ))}
                      </select>
                      {erreursContact.typeActivite && (
                        <span className="text-xs text-error">{erreursContact.typeActivite}</span>
                      )}
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Nombre de points de service
                      <input
                        type="number"
                        min={1}
                        className="border border-outline-variant rounded-lg px-3 py-2"
                        value={formContact.nombrePointsDeService}
                        onChange={(e) =>
                          setFormContact({
                            ...formContact,
                            nombrePointsDeService: e.target.value,
                          })
                        }
                      />
                      {erreursContact.nombrePointsDeService && (
                        <span className="text-xs text-error">
                          {erreursContact.nombrePointsDeService}
                        </span>
                      )}
                    </label>
                  </div>

                  <label className="flex flex-col gap-1 text-sm">
                    Comment pouvons-nous vous aider ? *
                    <select
                      className="border border-outline-variant rounded-lg px-3 py-2 bg-surface"
                      value={formContact.typeDemande}
                      onChange={(e) =>
                        setFormContact({
                          ...formContact,
                          typeDemande: e.target.value as TypeDemandeBusiness,
                        })
                      }
                    >
                      <option value="">Sélectionner…</option>
                      {Object.entries(LIBELLES_TYPE_DEMANDE_BUSINESS).map(([valeur, libelle]) => (
                        <option key={valeur} value={valeur}>
                          {libelle}
                        </option>
                      ))}
                    </select>
                    {erreursContact.typeDemande && (
                      <span className="text-xs text-error">{erreursContact.typeDemande}</span>
                    )}
                  </label>

                  <label className="flex flex-col gap-1 text-sm">
                    Décrivez votre besoin *
                    <textarea
                      rows={4}
                      className="border border-outline-variant rounded-lg px-3 py-2 resize-none"
                      placeholder="Expliquez-nous votre activité, le nombre de sites, vos besoins particuliers, vos intégrations éventuelles, etc."
                      value={formContact.message}
                      onChange={(e) => setFormContact({ ...formContact, message: e.target.value })}
                    />
                    {erreursContact.message && (
                      <span className="text-xs text-error">{erreursContact.message}</span>
                    )}
                  </label>

                  {erreurEnvoiContact && <p className="text-sm text-error">{erreurEnvoiContact}</p>}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={fermerModalContact}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={envoyerContact.isPending}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-60"
                    >
                      {envoyerContact.isPending ? 'Envoi en cours…' : 'Envoyer ma demande'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {etapeContact === 'SUCCES' && (
              <>
                <h2 className="text-lg font-bold text-on-background">Demande envoyée !</h2>
                <p className="text-sm text-on-surface-variant">
                  Merci pour votre demande. Notre équipe vous contactera prochainement pour discuter
                  de votre projet et vous proposer une offre adaptée.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={fermerModalContact}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary"
                  >
                    Fermer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
