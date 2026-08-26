import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { TenantListe } from '../lib/types';

const LIBELLES_STATUT: Record<string, string> = {
  ESSAI: 'En essai',
  ACTIVE: 'Active',
  EXPIREE: 'Expirée',
  SUSPENDUE: 'Suspendue',
};

const COULEURS_STATUT: Record<string, string> = {
  ESSAI: 'bg-status-pending/10 text-status-pending',
  ACTIVE: 'bg-status-delivered/10 text-status-delivered',
  EXPIREE: 'bg-error/10 text-error',
  SUSPENDUE: 'bg-error/10 text-error',
};

type Colonne = 'tenant' | 'plan' | 'statut' | 'createdAt';

const COLONNES: { cle: Colonne; libelle: string }[] = [
  { cle: 'tenant', libelle: 'Tenant' },
  { cle: 'plan', libelle: 'Plan' },
  { cle: 'statut', libelle: 'Statut licence' },
  { cle: 'createdAt', libelle: 'Créé le' },
];

function valeurTri(tenant: TenantListe, colonne: Colonne): string {
  switch (colonne) {
    case 'tenant':
      return tenant.nomPressing.toLocaleLowerCase('fr-FR');
    case 'plan':
      return tenant.plan;
    case 'statut':
      return tenant.licence?.statut ?? '';
    case 'createdAt':
      return tenant.createdAt;
  }
}

// Écran §015-web tranche 8 (licences/facturation super-admin) — liste des
// tenants, maquette de référence :
// docs/design/screens/gestion_des_licences_super_admin (section
// "Répertoire des tenants"). Les actions (activer/suspendre/...) et la
// facturation vivent sur SuperAdminTenantDetailPage, par tenant.
//
// Recherche + tri client uniquement : la liste complète est déjà chargée
// en un seul appel (pas de pagination côté API), inutile d'aller-retour
// serveur pour filtrer/trier un jeu de données de cette taille.
export function SuperAdminTenantsPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState<{ colonne: Colonne; sens: 'asc' | 'desc' }>({
    colonne: 'createdAt',
    sens: 'desc',
  });

  const tenants = useQuery({
    queryKey: ['super-admin-tenants'],
    queryFn: () => apiFetch<TenantListe[]>('/super-admin/tenants', { token }),
  });

  const tenantsAffiches = useMemo(() => {
    const rechercheNormalisee = recherche.trim().toLocaleLowerCase('fr-FR');
    const filtres = (tenants.data ?? []).filter(
      (tenant) =>
        rechercheNormalisee === '' ||
        tenant.nomPressing.toLocaleLowerCase('fr-FR').includes(rechercheNormalisee) ||
        tenant.sousDomaine.toLocaleLowerCase('fr-FR').includes(rechercheNormalisee),
    );
    const facteur = tri.sens === 'asc' ? 1 : -1;
    return [...filtres].sort(
      (a, b) => facteur * valeurTri(a, tri.colonne).localeCompare(valeurTri(b, tri.colonne)),
    );
  }, [tenants.data, recherche, tri]);

  function basculerTri(colonne: Colonne) {
    setTri((actuel) =>
      actuel.colonne === colonne
        ? { colonne, sens: actuel.sens === 'asc' ? 'desc' : 'asc' }
        : { colonne, sens: 'asc' },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-on-background">Tenants</h1>
        <p className="text-sm text-on-surface-variant">
          {tenantsAffiches.length} / {tenants.data?.length ?? 0} tenant(s) sur la plateforme
        </p>
      </div>

      <label className="relative w-full max-w-sm">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
          search
        </span>
        <input
          type="search"
          aria-label="Rechercher un tenant"
          placeholder="Rechercher un tenant (nom, sous-domaine)…"
          value={recherche}
          onChange={(event) => setRecherche(event.target.value)}
          className="w-full border border-outline-variant rounded-lg pl-10 pr-3 py-2 text-sm"
        />
      </label>

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-on-surface-variant">
              {COLONNES.map((colonne) => (
                <th key={colonne.cle} className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => basculerTri(colonne.cle)}
                    className="flex items-center gap-1 uppercase text-xs font-medium text-on-surface-variant hover:text-on-surface"
                  >
                    {colonne.libelle}
                    <span className="material-symbols-outlined text-[16px]">
                      {tri.colonne === colonne.cle
                        ? tri.sens === 'asc'
                          ? 'arrow_upward'
                          : 'arrow_downward'
                        : 'unfold_more'}
                    </span>
                  </button>
                </th>
              ))}
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.isPending && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={5}>
                  Chargement…
                </td>
              </tr>
            )}
            {!tenants.isPending && tenantsAffiches.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={5}>
                  Aucun tenant ne correspond à la recherche.
                </td>
              </tr>
            )}
            {tenantsAffiches.map((tenant) => (
              <tr key={tenant.id} className="border-t border-outline-variant">
                <td className="px-4 py-2">
                  <div className="font-medium">{tenant.nomPressing}</div>
                  <div className="text-on-surface-variant text-xs font-mono">
                    {tenant.sousDomaine}
                  </div>
                </td>
                <td className="px-4 py-2">{tenant.plan}</td>
                <td className="px-4 py-2">
                  {tenant.licence && (
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${COULEURS_STATUT[tenant.licence.statut]}`}
                    >
                      {LIBELLES_STATUT[tenant.licence.statut]}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-on-surface-variant">
                  {new Date(tenant.createdAt).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-2">
                  <Link
                    to={`/super-admin/tenants/${tenant.id}`}
                    className="text-primary text-xs font-medium"
                  >
                    Détails
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
