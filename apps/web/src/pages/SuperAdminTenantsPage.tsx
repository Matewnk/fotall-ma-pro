import { useQuery } from '@tanstack/react-query';
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

// Écran §015-web tranche 8 (licences/facturation super-admin) — liste des
// tenants, maquette de référence :
// docs/design/screens/gestion_des_licences_super_admin (section
// "Répertoire des tenants"). Les actions (activer/suspendre/...) et la
// facturation vivent sur SuperAdminTenantDetailPage, par tenant.
export function SuperAdminTenantsPage() {
  const { session } = useAuth();
  const token = session?.accessToken;

  const tenants = useQuery({
    queryKey: ['super-admin-tenants'],
    queryFn: () => apiFetch<TenantListe[]>('/super-admin/tenants', { token }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-on-background">Tenants</h1>
        <p className="text-sm text-on-surface-variant">
          {tenants.data?.length ?? 0} tenant(s) sur la plateforme
        </p>
      </div>

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-on-surface-variant">
              <th className="px-4 py-2">Tenant</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Statut licence</th>
              <th className="px-4 py-2">Créé le</th>
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
            {tenants.data?.map((tenant) => (
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
