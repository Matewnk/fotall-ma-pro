import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { AbonnementGlobal } from '../lib/types';

const PLANS: string[] = ['STARTER', 'PRO', 'BUSINESS'];
const STATUTS: string[] = ['ACTIF', 'EN_RETARD', 'ANNULE'];

const LIBELLES_STATUT: Record<string, string> = {
  ACTIF: 'Actif',
  EN_RETARD: 'En retard',
  ANNULE: 'Annulé',
};

const COULEURS_STATUT: Record<string, string> = {
  ACTIF: 'bg-status-delivered/10 text-status-delivered',
  EN_RETARD: 'bg-error/10 text-error',
  ANNULE: 'bg-surface-container-high text-on-surface-variant',
};

function formaterMontant(montant: number, devise: string): string {
  return `${new Intl.NumberFormat('fr-FR').format(montant)} ${devise}`;
}

// Écran §022-super-admin-enhancement — vue globale des abonnements/
// transactions, tous tenants confondus. Données réelles issues de
// GET /super-admin/facturation (billing.service.ts#listerFacturationGlobale),
// control-plane uniquement (Abonnement/Tenant). Aucune écriture ici : la
// création/modification d'un abonnement reste sur SuperAdminTenantDetailPage,
// par tenant — cohérent avec le caractère append-only de la facturation
// (Constitution IV) : cette page ne fait que lire l'état courant.
export function SuperAdminBillingPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [recherche, setRecherche] = useState('');
  const [filtrePlan, setFiltrePlan] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');

  const abonnements = useQuery({
    queryKey: ['super-admin-facturation-globale'],
    queryFn: () => apiFetch<AbonnementGlobal[]>('/super-admin/facturation', { token }),
  });

  const abonnementsAffiches = useMemo(() => {
    const rechercheNormalisee = recherche.trim().toLocaleLowerCase('fr-FR');
    return (abonnements.data ?? []).filter((abonnement) => {
      const correspondRecherche =
        rechercheNormalisee === '' ||
        abonnement.nomPressing.toLocaleLowerCase('fr-FR').includes(rechercheNormalisee) ||
        (abonnement.referenceProvider?.toLocaleLowerCase('fr-FR').includes(rechercheNormalisee) ??
          false);
      const correspondPlan = filtrePlan === '' || abonnement.plan === filtrePlan;
      const correspondStatut = filtreStatut === '' || abonnement.statut === filtreStatut;
      return correspondRecherche && correspondPlan && correspondStatut;
    });
  }, [abonnements.data, recherche, filtrePlan, filtreStatut]);

  const revenuTotalActif = abonnementsAffiches
    .filter((a) => a.statut === 'ACTIF')
    .reduce((total, a) => total + a.montant, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-on-background">Facturation</h1>
        <p className="text-sm text-on-surface-variant">
          {abonnementsAffiches.length} / {abonnements.data?.length ?? 0} abonnement(s) sur la
          plateforme
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="relative w-full max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            type="search"
            aria-label="Rechercher un abonnement"
            placeholder="Rechercher (tenant, référence)…"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            className="w-full border border-outline-variant rounded-lg pl-10 pr-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Plan
          <select
            value={filtrePlan}
            onChange={(event) => setFiltrePlan(event.target.value)}
            className="border border-outline-variant rounded-lg px-3 py-2"
          >
            <option value="">Tous</option>
            {PLANS.map((plan) => (
              <option key={plan} value={plan}>
                {plan}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Statut
          <select
            value={filtreStatut}
            onChange={(event) => setFiltreStatut(event.target.value)}
            className="border border-outline-variant rounded-lg px-3 py-2"
          >
            <option value="">Tous</option>
            {STATUTS.map((statut) => (
              <option key={statut} value={statut}>
                {LIBELLES_STATUT[statut]}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto text-sm text-on-surface-variant">
          Revenu actif (jeu filtré) :{' '}
          <span className="font-mono font-semibold text-on-background">
            {formaterMontant(revenuTotalActif, abonnementsAffiches[0]?.devise ?? 'XOF')}
          </span>
        </div>
      </div>

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-on-surface-variant">
              <th className="px-4 py-2">Tenant</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Montant</th>
              <th className="px-4 py-2">Mode</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Prochaine facturation</th>
              <th className="px-4 py-2">Référence</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {abonnements.isPending && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={8}>
                  Chargement…
                </td>
              </tr>
            )}
            {!abonnements.isPending && abonnementsAffiches.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={8}>
                  Aucun abonnement ne correspond à la recherche.
                </td>
              </tr>
            )}
            {abonnementsAffiches.map((abonnement) => (
              <tr key={abonnement.id} className="border-t border-outline-variant">
                <td className="px-4 py-2 font-medium text-on-surface">{abonnement.nomPressing}</td>
                <td className="px-4 py-2">{abonnement.plan}</td>
                <td className="px-4 py-2 font-mono">
                  {formaterMontant(abonnement.montant, abonnement.devise)}
                </td>
                <td className="px-4 py-2 text-on-surface-variant">{abonnement.modePaiement}</td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${COULEURS_STATUT[abonnement.statut]}`}
                  >
                    {LIBELLES_STATUT[abonnement.statut]}
                  </span>
                </td>
                <td className="px-4 py-2 text-on-surface-variant">
                  {new Date(abonnement.dateProchaineFacturation).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-2 text-on-surface-variant font-mono text-xs">
                  {abonnement.referenceProvider ?? '—'}
                </td>
                <td className="px-4 py-2">
                  <Link
                    to={`/super-admin/tenants/${abonnement.tenantId}`}
                    className="text-primary text-xs font-medium"
                  >
                    Voir le tenant
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
