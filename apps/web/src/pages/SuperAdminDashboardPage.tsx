import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

type StatsGlobales = {
  totalTenants: number;
  repartitionLicences: Record<'ESSAI' | 'ACTIVE' | 'EXPIREE' | 'SUSPENDUE', number>;
};

const LIBELLES_STATUT: Record<keyof StatsGlobales['repartitionLicences'], string> = {
  ESSAI: 'En essai',
  ACTIVE: 'Actives',
  EXPIREE: 'Expirées',
  SUSPENDUE: 'Suspendues',
};

// Écran §015-web (fondation console super-admin) — maquette de
// référence : docs/design/screens/tableau_de_bord_super_admin_saas.
// Revenu récurrent mensuel, commandes globales et licences expirant
// bientôt de la maquette non repris : GET /super-admin/stats ne calcule
// que le total de tenants et la répartition par statut de licence
// (stats.controller.ts) — adapté fidèlement à ce contrat plutôt qu'à des
// métriques inventées.
export function SuperAdminDashboardPage() {
  const { session } = useAuth();
  const token = session?.accessToken;

  const stats = useQuery({
    queryKey: ['super-admin-stats'],
    queryFn: () => apiFetch<StatsGlobales>('/super-admin/stats', { token }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-on-background">Vue globale</h1>
        <p className="text-sm text-on-surface-variant">
          État de la plateforme, tous tenants confondus.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-primary text-on-primary rounded-xl p-4">
          <p className="text-xs uppercase opacity-80">Tenants</p>
          <p className="text-2xl font-bold">{stats.data?.totalTenants ?? '—'}</p>
        </div>
        {(Object.keys(LIBELLES_STATUT) as (keyof StatsGlobales['repartitionLicences'])[]).map(
          (statut) => (
            <div key={statut} className="bg-surface border border-outline-variant rounded-xl p-4">
              <p className="text-xs text-on-surface-variant uppercase">{LIBELLES_STATUT[statut]}</p>
              <p className="text-2xl font-bold text-on-background">
                {stats.data?.repartitionLicences[statut] ?? '—'}
              </p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
