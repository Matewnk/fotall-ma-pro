import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, apiFetchBlob } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { declencherTelechargement, ouvrirBlobDansNouvelOnglet } from '../lib/download';
import type { FactureGlobale } from '../lib/types';

const PLANS: string[] = ['STARTER', 'PRO', 'BUSINESS'];
const STATUTS: string[] = ['EMISE', 'PAYEE', 'EN_RETARD', 'ANNULEE'];

const LIBELLES_STATUT: Record<string, string> = {
  EMISE: 'Émise',
  PAYEE: 'Payée',
  EN_RETARD: 'En retard',
  ANNULEE: 'Annulée',
};

const COULEURS_STATUT: Record<string, string> = {
  EMISE: 'bg-status-pending/10 text-status-pending',
  PAYEE: 'bg-status-ready/10 text-status-ready',
  EN_RETARD: 'bg-error/10 text-error',
  ANNULEE: 'bg-surface-container-high text-on-surface-variant',
};

function formaterMontant(montant: number, devise: string): string {
  return `${new Intl.NumberFormat('fr-FR').format(montant)} ${devise}`;
}

function estCeMois(dateIso: string): boolean {
  const date = new Date(dateIso);
  const maintenant = new Date();
  return (
    date.getUTCFullYear() === maintenant.getUTCFullYear() &&
    date.getUTCMonth() === maintenant.getUTCMonth()
  );
}

// Écran §023-subscriptions-invoicing (Phase 8) — vue globale des factures,
// tous tenants confondus. Distincte de SuperAdminBillingPage (qui liste les
// ABONNEMENTS, pas les factures individuelles) — deux modèles différents,
// deux pages différentes plutôt qu'un écran surchargé. KPI calculés en
// direct depuis les factures réellement chargées, jamais des chiffres
// inventés.
export function SuperAdminInvoicesPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [recherche, setRecherche] = useState('');
  const [filtrePlan, setFiltrePlan] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);

  const factures = useQuery({
    queryKey: ['super-admin-factures-globales'],
    queryFn: () => apiFetch<FactureGlobale[]>('/super-admin/factures', { token }),
  });

  const facturesAffichees = useMemo(() => {
    const rechercheNormalisee = recherche.trim().toLocaleLowerCase('fr-FR');
    return (factures.data ?? []).filter((facture) => {
      const correspondRecherche =
        rechercheNormalisee === '' ||
        facture.numero.toLocaleLowerCase('fr-FR').includes(rechercheNormalisee) ||
        facture.tenant.nomPressing.toLocaleLowerCase('fr-FR').includes(rechercheNormalisee);
      const correspondPlan = filtrePlan === '' || facture.planSnap === filtrePlan;
      const correspondStatut = filtreStatut === '' || facture.statut === filtreStatut;
      return correspondRecherche && correspondPlan && correspondStatut;
    });
  }, [factures.data, recherche, filtrePlan, filtreStatut]);

  const toutesFactures = factures.data ?? [];
  const facturesDuMois = toutesFactures.filter((f) => estCeMois(f.dateEmission));
  const facturesPayees = toutesFactures.filter((f) => f.statut === 'PAYEE');
  const facturesEnAttente = toutesFactures.filter((f) => f.statut === 'EMISE');
  const facturesEnRetard = toutesFactures.filter((f) => f.statut === 'EN_RETARD');
  const deviseDominante = toutesFactures[0]?.devise ?? 'XOF';
  const montantEncaisse = facturesPayees.reduce((total, f) => total + f.montant, 0);
  const montantARecevoir = [...facturesEnAttente, ...facturesEnRetard].reduce(
    (total, f) => total + f.montant,
    0,
  );

  async function handleVoir(facture: FactureGlobale) {
    setEnCours(facture.id);
    try {
      const blob = await apiFetchBlob(`/super-admin/factures/${facture.id}/pdf`, { token });
      ouvrirBlobDansNouvelOnglet(blob);
    } finally {
      setEnCours(null);
    }
  }

  async function handleTelecharger(facture: FactureGlobale) {
    setEnCours(facture.id);
    try {
      const blob = await apiFetchBlob(`/super-admin/factures/${facture.id}/pdf`, { token });
      declencherTelechargement(blob, `${facture.numero}.pdf`);
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-on-background">Factures</h1>
        <p className="text-sm text-on-surface-variant">
          {facturesAffichees.length} / {toutesFactures.length} facture(s) sur la plateforme
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <p className="text-xs uppercase text-on-surface-variant">Factures du mois</p>
          <p className="text-2xl font-bold text-on-background mt-1">{facturesDuMois.length}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <p className="text-xs uppercase text-on-surface-variant">Payées</p>
          <p className="text-2xl font-bold text-status-ready mt-1">{facturesPayees.length}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <p className="text-xs uppercase text-on-surface-variant">En attente</p>
          <p className="text-2xl font-bold text-status-pending mt-1">{facturesEnAttente.length}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <p className="text-xs uppercase text-on-surface-variant">En retard</p>
          <p className="text-2xl font-bold text-error mt-1">{facturesEnRetard.length}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <p className="text-xs uppercase text-on-surface-variant">Montant encaissé</p>
          <p className="text-xl font-bold text-on-background mt-1 font-mono">
            {formaterMontant(montantEncaisse, deviseDominante)}
          </p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <p className="text-xs uppercase text-on-surface-variant">Montant à recevoir</p>
          <p className="text-xl font-bold text-on-background mt-1 font-mono">
            {formaterMontant(montantARecevoir, deviseDominante)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="relative w-full max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            type="search"
            aria-label="Rechercher une facture"
            placeholder="Rechercher (numéro, tenant)…"
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
      </div>

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-on-surface-variant">
              <th className="px-4 py-2">N°</th>
              <th className="px-4 py-2">Tenant</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Montant</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Échéance</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Paiement</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {factures.isPending && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={9}>
                  Chargement…
                </td>
              </tr>
            )}
            {!factures.isPending && facturesAffichees.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={9}>
                  Aucune facture ne correspond à la recherche.
                </td>
              </tr>
            )}
            {facturesAffichees.map((facture) => (
              <tr key={facture.id} className="border-t border-outline-variant">
                <td className="px-4 py-2 font-mono text-xs">{facture.numero}</td>
                <td className="px-4 py-2 text-on-surface-variant">{facture.tenant.nomPressing}</td>
                <td className="px-4 py-2">{facture.planSnap}</td>
                <td className="px-4 py-2 font-mono">
                  {formaterMontant(facture.montant, facture.devise)}
                </td>
                <td className="px-4 py-2 text-on-surface-variant">
                  {new Date(facture.dateEmission).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-2 text-on-surface-variant">
                  {new Date(facture.dateEcheance).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${COULEURS_STATUT[facture.statut]}`}
                  >
                    {LIBELLES_STATUT[facture.statut]}
                  </span>
                </td>
                <td className="px-4 py-2 text-on-surface-variant">{facture.modePaiementSnap}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-primary text-xs font-medium disabled:opacity-60"
                      disabled={enCours === facture.id}
                      onClick={() => handleVoir(facture)}
                    >
                      Voir
                    </button>
                    <button
                      type="button"
                      className="text-primary text-xs font-medium disabled:opacity-60"
                      disabled={enCours === facture.id}
                      onClick={() => handleTelecharger(facture)}
                    >
                      Télécharger
                    </button>
                    <Link
                      to={`/super-admin/tenants/${facture.tenantId}`}
                      className="text-primary text-xs font-medium"
                    >
                      Tenant
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
