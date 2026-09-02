import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, apiFetch, apiFetchBlob } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { declencherTelechargement, ouvrirBlobDansNouvelOnglet } from '../lib/download';
import type {
  Abonnement,
  EntreeAudit,
  EvenementPlateforme,
  Facture,
  HistoriqueAbonnementEntry,
  ModePaiementFacturation,
  PlanCommercial,
  SessionSupport,
  TenantDetail,
  UtilisateurGlobal,
} from '../lib/types';

function genererIdempotencyKey(): string {
  return crypto.randomUUID();
}

const PLANS: PlanCommercial[] = ['STARTER', 'PRO', 'BUSINESS'];
const MODES_PAIEMENT: ModePaiementFacturation[] = ['CARTE', 'MOBILE_MONEY', 'VIREMENT'];

const ONGLETS = [
  'Informations',
  'Licence',
  'Abonnement',
  'Factures',
  'Paiements',
  'Utilisateurs',
  'Support',
  'Audit',
] as const;
type Onglet = (typeof ONGLETS)[number];

const LIBELLES_STATUT_FACTURE: Record<string, string> = {
  EMISE: 'Émise',
  PAYEE: 'Payée',
  EN_RETARD: 'En retard',
  ANNULEE: 'Annulée',
};

const COULEURS_STATUT_FACTURE: Record<string, string> = {
  EMISE: 'bg-status-pending/10 text-status-pending',
  PAYEE: 'bg-status-ready/10 text-status-ready',
  EN_RETARD: 'bg-error/10 text-error',
  ANNULEE: 'bg-surface-container-high text-on-surface-variant',
};

function formaterMontant(montant: number | string, devise: string): string {
  const nombre = typeof montant === 'string' ? Number(montant) : montant;
  return `${new Intl.NumberFormat('fr-FR').format(nombre)} ${devise}`;
}

// Écran §023-subscriptions-invoicing — fiche tenant réorganisée en
// sections distinctes (Phase 9 de la mission) : Informations / Licence /
// Abonnement / Factures / Paiements / Utilisateurs / Support / Audit,
// au lieu des sections précédentes (Licence/Plan/Facturation/Support) qui
// mélangeaient abonnement et facturation. Toutes les actions déjà
// existantes (licence, mode support) sont conservées à l'identique, juste
// redistribuées par onglet.
export function SuperAdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const [onglet, setOnglet] = useState<Onglet>('Informations');
  const [erreur, setErreur] = useState<string | null>(null);
  const [motifSuspension, setMotifSuspension] = useState('');
  const [motifRevocation, setMotifRevocation] = useState('');
  const [dureeJours, setDureeJours] = useState('30');
  const [planChoisi, setPlanChoisi] = useState<PlanCommercial>('STARTER');
  const [nouveauMontant, setNouveauMontant] = useState('');
  const [motifChangementPlan, setMotifChangementPlan] = useState('');
  const [motifSupport, setMotifSupport] = useState('');
  const [nouvelAbonnement, setNouvelAbonnement] = useState({
    plan: 'STARTER' as PlanCommercial,
    modePaiement: 'CARTE' as ModePaiementFacturation,
    montant: '',
    dateProchaineFacturation: '',
  });
  const [factureEnCours, setFactureEnCours] = useState<string | null>(null);
  const [utilisateurMdp, setUtilisateurMdp] = useState<UtilisateurGlobal | null>(null);
  const [etapeModalMdp, setEtapeModalMdp] = useState<'FORMULAIRE' | 'SUCCES'>('FORMULAIRE');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmerMotDePasse, setConfirmerMotDePasse] = useState('');
  const [erreurModalMdp, setErreurModalMdp] = useState<string | null>(null);

  const tenant = useQuery({
    queryKey: ['super-admin-tenant', id],
    queryFn: () => apiFetch<TenantDetail>(`/super-admin/tenants/${id}`, { token }),
    enabled: Boolean(id),
  });

  const abonnement = useQuery({
    queryKey: ['super-admin-facturation', id],
    queryFn: () => apiFetch<Abonnement>(`/super-admin/facturation/${id}`, { token }),
    enabled: Boolean(id),
    retry: false,
  });
  const aucunAbonnement = abonnement.error instanceof ApiError && abonnement.error.status === 404;

  const historique = useQuery({
    queryKey: ['super-admin-historique-abonnement', id],
    queryFn: () =>
      apiFetch<HistoriqueAbonnementEntry[]>(`/super-admin/tenants/${id}/historique-abonnement`, {
        token,
      }),
    enabled: Boolean(id) && onglet === 'Abonnement',
  });

  const factures = useQuery({
    queryKey: ['super-admin-factures', id],
    queryFn: () => apiFetch<Facture[]>(`/super-admin/tenants/${id}/factures`, { token }),
    enabled: Boolean(id) && onglet === 'Factures',
  });

  const utilisateurs = useQuery({
    queryKey: ['super-admin-tenant-utilisateurs', id],
    queryFn: () =>
      apiFetch<UtilisateurGlobal[]>(`/super-admin/utilisateurs?tenantId=${id}`, { token }),
    enabled: Boolean(id) && onglet === 'Utilisateurs',
  });

  const auditPlateforme = useQuery({
    queryKey: ['super-admin-tenant-audit', id],
    queryFn: () => apiFetch<EvenementPlateforme[]>(`/super-admin/audit?tenantId=${id}`, { token }),
    enabled: Boolean(id) && onglet === 'Audit',
  });

  const sessionSupport = useQuery({
    queryKey: ['super-admin-support-session', id],
    queryFn: () =>
      apiFetch<{ actif: boolean; session: SessionSupport | null }>(
        `/super-admin/tenants/${id}/support/session`,
        { token },
      ),
    enabled: Boolean(id),
  });

  const auditSupport = useQuery({
    queryKey: ['super-admin-support-audit', id],
    queryFn: () => apiFetch<EntreeAudit[]>(`/super-admin/tenants/${id}/support/audit`, { token }),
    enabled: Boolean(id) && sessionSupport.data?.actif === true,
  });

  function invaliderTenant() {
    queryClient.invalidateQueries({ queryKey: ['super-admin-tenant', id] });
    queryClient.invalidateQueries({ queryKey: ['super-admin-tenants'] });
  }

  const activer = useMutation({
    mutationFn: () =>
      apiFetch(`/super-admin/tenants/${id}/licence/activer`, {
        method: 'POST',
        token,
        body: { idempotencyKey: genererIdempotencyKey() },
      }),
    onSuccess: invaliderTenant,
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Action impossible.'),
  });

  const reactiver = useMutation({
    mutationFn: () =>
      apiFetch(`/super-admin/tenants/${id}/licence/reactiver`, {
        method: 'POST',
        token,
        body: { idempotencyKey: genererIdempotencyKey() },
      }),
    onSuccess: invaliderTenant,
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Action impossible.'),
  });

  const renouveler = useMutation({
    mutationFn: () =>
      apiFetch(`/super-admin/tenants/${id}/licence/renouveler`, {
        method: 'POST',
        token,
        body: { idempotencyKey: genererIdempotencyKey(), dureeJours: Number(dureeJours) },
      }),
    onSuccess: invaliderTenant,
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Action impossible.'),
  });

  const suspendre = useMutation({
    mutationFn: () =>
      apiFetch(`/super-admin/tenants/${id}/licence/suspendre`, {
        method: 'POST',
        token,
        body: { idempotencyKey: genererIdempotencyKey(), motif: motifSuspension },
      }),
    onSuccess: () => {
      invaliderTenant();
      setMotifSuspension('');
    },
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Action impossible.'),
  });

  const revoquer = useMutation({
    mutationFn: () =>
      apiFetch(`/super-admin/tenants/${id}/licence/revoquer`, {
        method: 'POST',
        token,
        body: { idempotencyKey: genererIdempotencyKey(), motif: motifRevocation },
      }),
    onSuccess: () => {
      invaliderTenant();
      setMotifRevocation('');
    },
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Action impossible.'),
  });

  const changerPlan = useMutation({
    mutationFn: () =>
      apiFetch(`/super-admin/tenants/${id}/plan`, {
        method: 'PATCH',
        token,
        body: {
          plan: planChoisi,
          ...(nouveauMontant ? { nouveauMontant: Number(nouveauMontant) } : {}),
          ...(motifChangementPlan ? { motif: motifChangementPlan } : {}),
        },
      }),
    onSuccess: () => {
      invaliderTenant();
      queryClient.invalidateQueries({ queryKey: ['super-admin-facturation', id] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-historique-abonnement', id] });
      setNouveauMontant('');
      setMotifChangementPlan('');
    },
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Action impossible.'),
  });

  // §022-super-admin-enhancement : toute action sensible sur la licence ou
  // le plan demande confirmation — cohérent avec la convention déjà en
  // place ailleurs dans l'app (window.confirm sur ClientsPage/ServicesPage/
  // UsersPage), pas de nouvelle bibliothèque de modale.
  function handleActiver() {
    if (window.confirm(`Activer la licence de « ${tenant.data?.nomPressing} » ?`)) {
      activer.mutate();
    }
  }
  function handleReactiver() {
    if (
      window.confirm(
        `Réactiver la licence de « ${tenant.data?.nomPressing} » ? Cela lève la suspension.`,
      )
    ) {
      reactiver.mutate();
    }
  }
  function handleRenouveler() {
    if (
      window.confirm(
        `Renouveler la licence de « ${tenant.data?.nomPressing} » de ${dureeJours} jour(s) ?`,
      )
    ) {
      renouveler.mutate();
    }
  }
  function handleSuspendre() {
    if (
      window.confirm(
        `Suspendre la licence de « ${tenant.data?.nomPressing} » ? Le pressing perdra l'accès à l'application jusqu'à réactivation.\nMotif : ${motifSuspension}`,
      )
    ) {
      suspendre.mutate();
    }
  }
  function handleRevoquer() {
    if (
      window.confirm(
        `Révoquer DÉFINITIVEMENT la licence de « ${tenant.data?.nomPressing} » ? Cette action est irréversible.\nMotif : ${motifRevocation}`,
      )
    ) {
      revoquer.mutate();
    }
  }
  // Phase 1 de la mission : la confirmation affiche ancien/nouveau prix —
  // jamais de prorata calculé (voir specs/023-subscriptions-invoicing/spec.md).
  function handleChangerPlan() {
    const ancienPrix = abonnement.data
      ? formaterMontant(abonnement.data.montant, abonnement.data.devise)
      : '—';
    const nouveauPrixAffiche = nouveauMontant
      ? formaterMontant(Number(nouveauMontant), abonnement.data?.devise ?? 'XOF')
      : `${ancienPrix} (inchangé)`;
    if (
      window.confirm(
        `Changer de :\n${tenant.data?.plan}\n\nvers :\n${planChoisi}\n\nAncien prix : ${ancienPrix}\nNouveau prix : ${nouveauPrixAffiche}\n\nAucun prorata n'est calculé — le nouveau prix s'applique à la prochaine facture.`,
      )
    ) {
      changerPlan.mutate();
    }
  }

  const creerAbonnement = useMutation({
    mutationFn: () =>
      apiFetch(`/super-admin/facturation/${id}/abonnement`, {
        method: 'POST',
        token,
        body: {
          plan: nouvelAbonnement.plan,
          modePaiement: nouvelAbonnement.modePaiement,
          montant: Number(nouvelAbonnement.montant),
          dateProchaineFacturation: nouvelAbonnement.dateProchaineFacturation,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-facturation', id] });
      invaliderTenant();
    },
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Action impossible.'),
  });

  const genererFacture = useMutation({
    mutationFn: () =>
      apiFetch<Facture>(`/super-admin/tenants/${id}/factures`, {
        method: 'POST',
        token,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-factures', id] });
      setErreur(null);
    },
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Génération impossible.'),
  });

  const changerStatutFacture = useMutation({
    mutationFn: ({ factureId, statut }: { factureId: string; statut: 'PAYEE' | 'ANNULEE' }) =>
      apiFetch(`/super-admin/factures/${factureId}/statut`, {
        method: 'PATCH',
        token,
        body: { statut },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['super-admin-factures', id] }),
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Action impossible.'),
  });

  async function handleVoirFacture(facture: Facture) {
    setFactureEnCours(facture.id);
    try {
      const blob = await apiFetchBlob(`/super-admin/factures/${facture.id}/pdf`, { token });
      ouvrirBlobDansNouvelOnglet(blob);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Ouverture impossible.');
    } finally {
      setFactureEnCours(null);
    }
  }

  async function handleTelechargerFacture(facture: Facture) {
    setFactureEnCours(facture.id);
    try {
      const blob = await apiFetchBlob(`/super-admin/factures/${facture.id}/pdf`, { token });
      declencherTelechargement(blob, `${facture.numero}.pdf`);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Téléchargement impossible.');
    } finally {
      setFactureEnCours(null);
    }
  }

  const demarrerSupport = useMutation({
    mutationFn: () =>
      apiFetch(`/super-admin/tenants/${id}/support/demarrer`, {
        method: 'POST',
        token,
        body: { motif: motifSupport },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-support-session', id] });
      setMotifSupport('');
    },
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Action impossible.'),
  });

  const terminerSupport = useMutation({
    mutationFn: () =>
      apiFetch(`/super-admin/tenants/${id}/support/terminer`, { method: 'POST', token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-support-session', id] });
    },
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Action impossible.'),
  });

  // Support : le Super-Admin ne voit jamais l'ancien mot de passe (seul le
  // hash existe en base) — il en définit un nouveau, temporaire, que
  // l'utilisateur devra changer à sa prochaine connexion
  // (mustChangePassword forcé côté serveur, non négociable depuis ce
  // formulaire).
  const reinitialiserMdp = useMutation({
    mutationFn: () =>
      apiFetch(`/super-admin/tenants/${id}/utilisateurs/${utilisateurMdp?.id}/mot-de-passe`, {
        method: 'PATCH',
        token,
        body: { motDePasse: nouveauMotDePasse, confirmerMotDePasse },
      }),
    onSuccess: () => {
      setEtapeModalMdp('SUCCES');
    },
    onError: (e) => {
      setErreurModalMdp(e instanceof ApiError ? e.message : 'La réinitialisation a échoué.');
    },
  });

  function ouvrirModalMdp(utilisateur: UtilisateurGlobal) {
    setUtilisateurMdp(utilisateur);
    setEtapeModalMdp('FORMULAIRE');
    setNouveauMotDePasse('');
    setConfirmerMotDePasse('');
    setErreurModalMdp(null);
  }

  function fermerModalMdp() {
    setUtilisateurMdp(null);
  }

  function handleSubmitMdp(event: FormEvent) {
    event.preventDefault();
    setErreurModalMdp(null);
    if (nouveauMotDePasse !== confirmerMotDePasse) {
      setErreurModalMdp('La confirmation ne correspond pas.');
      return;
    }
    reinitialiserMdp.mutate();
  }

  if (tenant.isPending) {
    return <p className="text-sm text-on-surface-variant">Chargement…</p>;
  }
  if (!tenant.data) {
    return <p className="text-sm text-error">Tenant introuvable.</p>;
  }

  const boutonClasse =
    'rounded-lg px-4 py-2 text-sm font-medium border border-outline-variant text-on-surface-variant disabled:opacity-60';

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-on-background">{tenant.data.nomPressing}</h1>
        <p className="text-sm text-on-surface-variant font-mono">{tenant.data.sousDomaine}</p>
      </div>

      {erreur && <p className="text-sm text-error">{erreur}</p>}

      <div className="flex flex-wrap gap-1 border-b border-outline-variant">
        {ONGLETS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setOnglet(item)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              onglet === item
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {onglet === 'Informations' && (
        <section className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Nom du pressing</span>
            <span className="font-medium">{tenant.data.nomPressing}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Identifiant tenant</span>
            <span className="font-mono">{tenant.data.sousDomaine}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Propriétaire</span>
            <span>{tenant.data.proprietaire ?? 'Non disponible'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Utilisateurs</span>
            <span>{tenant.data.nombreUtilisateurs}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Langue</span>
            <span>{tenant.data.langue}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Devise</span>
            <span>{tenant.data.devise}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Fuseau horaire</span>
            <span>{tenant.data.fuseauHoraire}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Créé le</span>
            <span>{new Date(tenant.data.createdAt).toLocaleDateString('fr-FR')}</span>
          </div>
        </section>
      )}

      {onglet === 'Licence' && (
        <section className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-4">
          <p className="text-sm text-on-surface-variant">
            Statut actuel : <span className="font-medium">{tenant.data.licence?.statut}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={boutonClasse}
              disabled={activer.isPending}
              onClick={handleActiver}
            >
              Activer
            </button>
            <button
              type="button"
              className={boutonClasse}
              disabled={reactiver.isPending}
              onClick={handleReactiver}
            >
              Réactiver
            </button>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              Renouveler (jours)
              <input
                type="number"
                min={1}
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={dureeJours}
                onChange={(event) => setDureeJours(event.target.value)}
              />
            </label>
            <button
              type="button"
              className={boutonClasse}
              disabled={renouveler.isPending}
              onClick={handleRenouveler}
            >
              Renouveler
            </button>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm flex-1">
              Motif de suspension
              <input
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={motifSuspension}
                onChange={(event) => setMotifSuspension(event.target.value)}
              />
            </label>
            <button
              type="button"
              className={boutonClasse}
              disabled={suspendre.isPending || motifSuspension.length < 3}
              onClick={handleSuspendre}
            >
              Suspendre
            </button>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm flex-1">
              Motif de révocation (définitif)
              <input
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={motifRevocation}
                onChange={(event) => setMotifRevocation(event.target.value)}
              />
            </label>
            <button
              type="button"
              className={`${boutonClasse} text-error`}
              disabled={revoquer.isPending || motifRevocation.length < 3}
              onClick={handleRevoquer}
            >
              Révoquer
            </button>
          </div>
        </section>
      )}

      {onglet === 'Abonnement' && (
        <div className="flex flex-col gap-4">
          <section className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-4">
            <h2 className="font-semibold text-on-background">Abonnement</h2>
            {abonnement.isPending && <p className="text-sm text-on-surface-variant">Chargement…</p>}
            {abonnement.data && (
              <dl className="text-sm flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">Plan actuel</dt>
                  <dd className="font-medium">{abonnement.data.plan}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">Prix</dt>
                  <dd className="font-mono">
                    {formaterMontant(abonnement.data.montant, abonnement.data.devise)} / mois
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">Statut</dt>
                  <dd>{abonnement.data.statut}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">Prochaine facture</dt>
                  <dd>
                    {new Date(abonnement.data.dateProchaineFacturation).toLocaleDateString('fr-FR')}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">Paiement</dt>
                  <dd>{abonnement.data.modePaiement}</dd>
                </div>
              </dl>
            )}
            {aucunAbonnement && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-on-surface-variant">Aucun abonnement pour ce tenant.</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    Plan
                    <select
                      className="border border-outline-variant rounded-lg px-3 py-2"
                      value={nouvelAbonnement.plan}
                      onChange={(event) =>
                        setNouvelAbonnement((a) => ({
                          ...a,
                          plan: event.target.value as PlanCommercial,
                        }))
                      }
                    >
                      {PLANS.map((plan) => (
                        <option key={plan} value={plan}>
                          {plan}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Mode de paiement
                    <select
                      className="border border-outline-variant rounded-lg px-3 py-2"
                      value={nouvelAbonnement.modePaiement}
                      onChange={(event) =>
                        setNouvelAbonnement((a) => ({
                          ...a,
                          modePaiement: event.target.value as ModePaiementFacturation,
                        }))
                      }
                    >
                      {MODES_PAIEMENT.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Montant
                    <input
                      type="number"
                      min={0}
                      className="border border-outline-variant rounded-lg px-3 py-2"
                      value={nouvelAbonnement.montant}
                      onChange={(event) =>
                        setNouvelAbonnement((a) => ({ ...a, montant: event.target.value }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Prochaine facturation
                    <input
                      type="date"
                      className="border border-outline-variant rounded-lg px-3 py-2"
                      value={nouvelAbonnement.dateProchaineFacturation}
                      onChange={(event) =>
                        setNouvelAbonnement((a) => ({
                          ...a,
                          dateProchaineFacturation: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className={`${boutonClasse} self-start`}
                  disabled={creerAbonnement.isPending}
                  onClick={() => creerAbonnement.mutate()}
                >
                  Créer l'abonnement
                </button>
              </div>
            )}

            {abonnement.data && (
              <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant">
                <div className="flex items-end gap-2 flex-wrap">
                  <label className="flex flex-col gap-1 text-sm">
                    Changer de plan
                    <select
                      className="border border-outline-variant rounded-lg px-3 py-2"
                      value={planChoisi}
                      onChange={(event) => setPlanChoisi(event.target.value as PlanCommercial)}
                    >
                      {PLANS.map((plan) => (
                        <option key={plan} value={plan}>
                          {plan}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Nouveau prix (optionnel)
                    <input
                      type="number"
                      min={0}
                      placeholder="Inchangé"
                      className="border border-outline-variant rounded-lg px-3 py-2 w-32"
                      value={nouveauMontant}
                      onChange={(event) => setNouveauMontant(event.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm flex-1 min-w-[180px]">
                    Motif
                    <input
                      className="border border-outline-variant rounded-lg px-3 py-2"
                      value={motifChangementPlan}
                      onChange={(event) => setMotifChangementPlan(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className={boutonClasse}
                    disabled={changerPlan.isPending}
                    onClick={handleChangerPlan}
                  >
                    Changer le plan
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
            <div className="px-4 py-3 border-b border-outline-variant">
              <h2 className="font-semibold text-on-background">Historique abonnement</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-on-surface-variant">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Changement</th>
                  <th className="px-4 py-2">Prix</th>
                  <th className="px-4 py-2">Super Admin</th>
                  <th className="px-4 py-2">Motif</th>
                </tr>
              </thead>
              <tbody>
                {historique.data?.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-on-surface-variant" colSpan={5}>
                      Aucun changement de plan pour l'instant.
                    </td>
                  </tr>
                )}
                {historique.data?.map((entree) => (
                  <tr key={entree.id} className="border-t border-outline-variant">
                    <td className="px-4 py-2 text-on-surface-variant">
                      {new Date(entree.dateEffet).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-2">
                      {entree.ancienPlan} → {entree.nouveauPlan}
                    </td>
                    <td className="px-4 py-2 font-mono">
                      {entree.ancienPrix !== null
                        ? formaterMontant(entree.ancienPrix, entree.devise)
                        : '—'}
                      {' → '}
                      {entree.nouveauPrix !== null
                        ? formaterMontant(entree.nouveauPrix, entree.devise)
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-on-surface-variant text-xs font-mono">
                      {entree.effectuePar}
                    </td>
                    <td className="px-4 py-2 text-on-surface-variant">{entree.motif ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {onglet === 'Factures' && (
        <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
            <h2 className="font-semibold text-on-background">Factures</h2>
            <button
              type="button"
              className={boutonClasse}
              disabled={genererFacture.isPending || !abonnement.data}
              onClick={() => genererFacture.mutate()}
            >
              {genererFacture.isPending ? 'Génération…' : 'Créer une facture'}
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-on-surface-variant">
                <th className="px-4 py-2">N°</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Montant</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Échéance</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {factures.data?.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-on-surface-variant" colSpan={7}>
                    Aucune facture pour l'instant.
                  </td>
                </tr>
              )}
              {factures.data?.map((facture) => (
                <tr key={facture.id} className="border-t border-outline-variant">
                  <td className="px-4 py-2 font-mono text-xs">{facture.numero}</td>
                  <td className="px-4 py-2 text-on-surface-variant">
                    {new Date(facture.dateEmission).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-2">{facture.planSnap}</td>
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
                  <td className="px-4 py-2 text-on-surface-variant">
                    {new Date(facture.dateEcheance).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-primary text-xs font-medium disabled:opacity-60"
                        disabled={factureEnCours === facture.id}
                        onClick={() => handleVoirFacture(facture)}
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
                      {facture.statut === 'EMISE' && (
                        <button
                          type="button"
                          className="text-status-ready text-xs font-medium"
                          onClick={() =>
                            changerStatutFacture.mutate({ factureId: facture.id, statut: 'PAYEE' })
                          }
                        >
                          Marquer payée
                        </button>
                      )}
                      {facture.statut !== 'ANNULEE' && (
                        <button
                          type="button"
                          className="text-error text-xs font-medium"
                          onClick={() => {
                            if (window.confirm(`Annuler la facture ${facture.numero} ?`)) {
                              changerStatutFacture.mutate({
                                factureId: facture.id,
                                statut: 'ANNULEE',
                              });
                            }
                          }}
                        >
                          Annuler
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {onglet === 'Paiements' && (
        <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
          <div className="px-4 py-3 border-b border-outline-variant">
            <h2 className="font-semibold text-on-background">Paiements</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-on-surface-variant">
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Montant</th>
                <th className="px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {(abonnement.data?.journal.length ?? 0) === 0 && (
                <tr>
                  <td className="px-4 py-4 text-on-surface-variant" colSpan={3}>
                    Aucun évènement de paiement pour l'instant.
                  </td>
                </tr>
              )}
              {abonnement.data?.journal.map((entree) => (
                <tr key={entree.id} className="border-t border-outline-variant">
                  <td className="px-4 py-2">{entree.type}</td>
                  <td className="px-4 py-2 font-mono">
                    {entree.montant ? `${entree.montant} ${entree.devise ?? ''}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-on-surface-variant">
                    {new Date(entree.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {onglet === 'Utilisateurs' && (
        <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-on-surface-variant">
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Rôle</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Créé le</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {utilisateurs.data?.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-on-surface-variant" colSpan={5}>
                    Aucun utilisateur.
                  </td>
                </tr>
              )}
              {utilisateurs.data?.map((utilisateur) => (
                <tr key={utilisateur.id} className="border-t border-outline-variant">
                  <td className="px-4 py-2 font-medium text-on-surface">{utilisateur.email}</td>
                  <td className="px-4 py-2">{utilisateur.role}</td>
                  <td className="px-4 py-2">{utilisateur.actif ? 'Actif' : 'Inactif'}</td>
                  <td className="px-4 py-2 text-on-surface-variant">
                    {new Date(utilisateur.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => ouvrirModalMdp(utilisateur)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium border border-outline-variant text-on-surface-variant hover:bg-surface-container-high"
                    >
                      Réinitialiser le mot de passe
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {utilisateurMdp && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={fermerModalMdp}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-modal-reinitialisation-mdp"
            className="w-full max-w-md rounded-xl border border-outline-variant bg-surface p-6 shadow-xl flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {etapeModalMdp === 'FORMULAIRE' && (
              <form onSubmit={handleSubmitMdp} className="flex flex-col gap-4">
                <h2
                  id="titre-modal-reinitialisation-mdp"
                  className="text-lg font-bold text-on-background"
                >
                  Réinitialiser le mot de passe
                </h2>
                <p className="text-sm text-on-surface-variant">
                  {utilisateurMdp.role === 'ADMIN' ? (
                    <>
                      Vous êtes sur le point de réinitialiser le mot de passe du{' '}
                      <strong className="text-on-background">propriétaire</strong> de ce pressing (
                      <span className="font-medium">{utilisateurMdp.email}</span>).
                    </>
                  ) : (
                    <>
                      Réinitialiser le mot de passe de{' '}
                      <span className="font-medium">{utilisateurMdp.email}</span> ?
                    </>
                  )}
                </p>
                <label className="flex flex-col gap-1 text-sm">
                  Nouveau mot de passe
                  <input
                    type="password"
                    className="border border-outline-variant rounded-lg px-3 py-2"
                    value={nouveauMotDePasse}
                    onChange={(event) => setNouveauMotDePasse(event.target.value)}
                    minLength={8}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Confirmer le mot de passe
                  <input
                    type="password"
                    className="border border-outline-variant rounded-lg px-3 py-2"
                    value={confirmerMotDePasse}
                    onChange={(event) => setConfirmerMotDePasse(event.target.value)}
                    minLength={8}
                    required
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <input type="checkbox" checked disabled />
                  L'utilisateur devra changer son mot de passe à sa prochaine connexion.
                </label>

                {erreurModalMdp && <p className="text-sm text-error">{erreurModalMdp}</p>}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={fermerModalMdp}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={reinitialiserMdp.isPending}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-60"
                  >
                    {reinitialiserMdp.isPending ? 'Réinitialisation…' : 'Réinitialiser'}
                  </button>
                </div>
              </form>
            )}

            {etapeModalMdp === 'SUCCES' && (
              <>
                <h2 className="text-lg font-bold text-on-background">
                  Le mot de passe a été réinitialisé.
                </h2>
                <p className="text-sm text-on-surface-variant">
                  L'utilisateur devra définir un nouveau mot de passe à sa prochaine connexion.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={fermerModalMdp}
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

      {onglet === 'Support' && (
        <section className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-4">
          <p className="text-sm text-on-surface-variant">
            Aucun accès direct aux données de ce tenant : consultation possible uniquement pendant
            une session support active et motivée.
          </p>
          {!sessionSupport.data?.actif && (
            <div className="flex items-end gap-2">
              <label className="flex flex-col gap-1 text-sm flex-1">
                Motif de la session support
                <input
                  className="border border-outline-variant rounded-lg px-3 py-2"
                  value={motifSupport}
                  onChange={(event) => setMotifSupport(event.target.value)}
                />
              </label>
              <button
                type="button"
                className={boutonClasse}
                disabled={demarrerSupport.isPending || motifSupport.length < 3}
                onClick={() => demarrerSupport.mutate()}
              >
                Démarrer la session
              </button>
            </div>
          )}
          {sessionSupport.data?.actif && sessionSupport.data.session && (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                Session active depuis{' '}
                {new Date(sessionSupport.data.session.startedAt).toLocaleString('fr-FR')} — motif :{' '}
                {sessionSupport.data.session.motif}
              </p>
              <button
                type="button"
                className={`${boutonClasse} self-start`}
                disabled={terminerSupport.isPending}
                onClick={() => terminerSupport.mutate()}
              >
                Terminer la session
              </button>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-on-surface-variant uppercase">
                      <th className="px-3 py-1">Date</th>
                      <th className="px-3 py-1">Action</th>
                      <th className="px-3 py-1">Entité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditSupport.data?.length === 0 && (
                      <tr>
                        <td className="px-3 py-2 text-on-surface-variant" colSpan={3}>
                          Aucune entrée d'audit pour ce tenant.
                        </td>
                      </tr>
                    )}
                    {auditSupport.data?.map((entree) => (
                      <tr key={entree.id} className="border-t border-outline-variant">
                        <td className="px-3 py-1">
                          {new Date(entree.createdAt).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-3 py-1 font-mono">{entree.action}</td>
                        <td className="px-3 py-1">
                          {entree.entityType} #{entree.entityId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {onglet === 'Audit' && (
        <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-on-surface-variant">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Motif</th>
              </tr>
            </thead>
            <tbody>
              {auditPlateforme.data?.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-on-surface-variant" colSpan={4}>
                    Aucun évènement plateforme pour ce tenant.
                  </td>
                </tr>
              )}
              {auditPlateforme.data?.map((evenement) => (
                <tr
                  key={`${evenement.type}-${evenement.id}`}
                  className="border-t border-outline-variant"
                >
                  <td className="px-4 py-2 text-on-surface-variant">
                    {new Date(evenement.createdAt).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-4 py-2">
                    {evenement.type === 'LICENCE' ? 'Licence' : 'Support'}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{evenement.action}</td>
                  <td className="px-4 py-2 text-on-surface-variant">{evenement.motif ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
