import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type {
  Abonnement,
  EntreeAudit,
  ModePaiementFacturation,
  PlanCommercial,
  SessionSupport,
  TenantDetail,
} from '../lib/types';

function genererIdempotencyKey(): string {
  return crypto.randomUUID();
}

const PLANS: PlanCommercial[] = ['STARTER', 'PRO', 'BUSINESS'];
const MODES_PAIEMENT: ModePaiementFacturation[] = ['CARTE', 'MOBILE_MONEY', 'VIREMENT'];

// Écran §015-web tranche 8 (licences + facturation super-admin) — actions
// complètes sur un tenant sélectionné. Maquettes de référence :
// gestion_des_licences_super_admin (section actions) et
// facturation_abonnements_saas_tenant. Regroupées sur un seul écran (plutôt
// que deux séparés) : les deux mockups agissent sur le même tenant
// sélectionné, cohérent avec le modèle "liste puis détail" des deux
// maquettes.
export function SuperAdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const [erreur, setErreur] = useState<string | null>(null);
  const [motifSuspension, setMotifSuspension] = useState('');
  const [motifRevocation, setMotifRevocation] = useState('');
  const [dureeJours, setDureeJours] = useState('30');
  const [planChoisi, setPlanChoisi] = useState<PlanCommercial>('STARTER');
  const [motifSupport, setMotifSupport] = useState('');
  const [nouvelAbonnement, setNouvelAbonnement] = useState({
    plan: 'STARTER' as PlanCommercial,
    modePaiement: 'CARTE' as ModePaiementFacturation,
    montant: '',
    dateProchaineFacturation: '',
  });

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
        body: { plan: planChoisi },
      }),
    onSuccess: invaliderTenant,
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Action impossible.'),
  });

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

  if (tenant.isPending) {
    return <p className="text-sm text-on-surface-variant">Chargement…</p>;
  }
  if (!tenant.data) {
    return <p className="text-sm text-error">Tenant introuvable.</p>;
  }

  const boutonClasse =
    'rounded-lg px-4 py-2 text-sm font-medium border border-outline-variant text-on-surface-variant disabled:opacity-60';

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-on-background">{tenant.data.nomPressing}</h1>
        <p className="text-sm text-on-surface-variant font-mono">{tenant.data.sousDomaine}</p>
      </div>

      {erreur && <p className="text-sm text-error">{erreur}</p>}

      <section className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-4">
        <h2 className="font-semibold text-on-background">Licence</h2>
        <p className="text-sm text-on-surface-variant">
          Statut actuel : <span className="font-medium">{tenant.data.licence?.statut}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={boutonClasse}
            disabled={activer.isPending}
            onClick={() => activer.mutate()}
          >
            Activer
          </button>
          <button
            type="button"
            className={boutonClasse}
            disabled={reactiver.isPending}
            onClick={() => reactiver.mutate()}
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
            onClick={() => renouveler.mutate()}
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
            onClick={() => suspendre.mutate()}
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
            onClick={() => revoquer.mutate()}
          >
            Révoquer
          </button>
        </div>
      </section>

      <section className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-4">
        <h2 className="font-semibold text-on-background">Plan</h2>
        <p className="text-sm text-on-surface-variant">
          Plan actuel : <span className="font-medium">{tenant.data.plan}</span>
        </p>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Nouveau plan
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
          <button
            type="button"
            className={boutonClasse}
            disabled={changerPlan.isPending}
            onClick={() => changerPlan.mutate()}
          >
            Mettre à jour
          </button>
        </div>
      </section>

      <section className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-4">
        <h2 className="font-semibold text-on-background">Facturation</h2>
        {abonnement.isPending && <p className="text-sm text-on-surface-variant">Chargement…</p>}
        {abonnement.data && (
          <div className="text-sm flex flex-col gap-2">
            <p>
              Abonnement {abonnement.data.plan} — {abonnement.data.montant} {abonnement.data.devise}{' '}
              ({abonnement.data.modePaiement})
            </p>
            <p className="text-on-surface-variant">Statut : {abonnement.data.statut}</p>
            {abonnement.data.journal.length > 0 && (
              <table className="w-full text-xs mt-2">
                <thead>
                  <tr className="text-left text-on-surface-variant uppercase">
                    <th className="py-1">Type</th>
                    <th className="py-1">Montant</th>
                    <th className="py-1">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {abonnement.data.journal.map((entree) => (
                    <tr key={entree.id} className="border-t border-outline-variant">
                      <td className="py-1">{entree.type}</td>
                      <td className="py-1">
                        {entree.montant ? `${entree.montant} ${entree.devise ?? ''}` : '—'}
                      </td>
                      <td className="py-1">
                        {new Date(entree.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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
      </section>

      <section className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-4">
        <h2 className="font-semibold text-on-background">Support</h2>
        <p className="text-sm text-on-surface-variant">
          Aucun accès direct aux données de ce tenant : consultation possible uniquement pendant une
          session support active et motivée.
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
    </div>
  );
}
