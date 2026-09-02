import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

type StatutLicence = 'ESSAI' | 'ACTIVE' | 'EXPIREE' | 'SUSPENDUE';
type PlanCommercial = 'STARTER' | 'PRO' | 'BUSINESS';

type StatsGlobales = {
  totalTenants: number;
  repartitionLicences: Record<StatutLicence, number>;
  revenuMensuel: { devise: string; montant: number };
  revenuMensuelAutresDevises: { devise: string; montant: number }[];
  nouveauxAbonnementsMois: number;
  tauxRetention: number;
  revenuParPlan: { plan: PlanCommercial; montant: number }[];
  evolutionRevenusMensuels: { mois: string; montant: number }[];
  inscriptionsRecentes: {
    tenantId: string;
    nomPressing: string;
    sousDomaine: string;
    plan: PlanCommercial;
    createdAt: string;
    statutLicence: StatutLicence | null;
  }[];
  alertes: {
    paiementsEnRetard: {
      tenantId: string;
      nomPressing: string;
      montant: number;
      devise: string;
      depuis: string;
    }[];
    licencesExpirantBientot: {
      tenantId: string;
      nomPressing: string;
      statut: StatutLicence;
      dateEcheance: string;
      joursRestants: number;
    }[];
  };
};

const LIBELLES_STATUT: Record<StatutLicence, string> = {
  ESSAI: 'En essai',
  ACTIVE: 'Active',
  EXPIREE: 'Expirée',
  SUSPENDUE: 'Suspendue',
};

const COULEURS_STATUT: Record<StatutLicence, string> = {
  ESSAI: 'bg-status-pending/10 text-status-pending',
  ACTIVE: 'bg-status-delivered/10 text-status-delivered',
  EXPIREE: 'bg-error/10 text-error',
  SUSPENDUE: 'bg-error/10 text-error',
};

const LIBELLES_PLAN: Record<PlanCommercial, string> = {
  STARTER: 'Starter',
  PRO: 'Pro',
  BUSINESS: 'Business',
};

const LIBELLES_MOIS: Record<string, string> = {
  '01': 'Jan',
  '02': 'Fév',
  '03': 'Mar',
  '04': 'Avr',
  '05': 'Mai',
  '06': 'Juin',
  '07': 'Juil',
  '08': 'Août',
  '09': 'Sep',
  '10': 'Oct',
  '11': 'Nov',
  '12': 'Déc',
};

function formaterMontant(montant: number, devise: string): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(montant))} ${devise}`;
}

function formaterDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

// Écran §005-super-admin — maquette de référence :
// docs/design/screens/tableau_de_bord_superAdmin. Chaque métrique vient de
// GET /super-admin/stats (stats.service.ts), calculée depuis les abonnements,
// le journal de paiements et les licences réels — aucun chiffre inventé
// côté frontend. Les agrégats monétaires portent sur la devise la plus
// représentée parmi les abonnements actifs ; les autres devises sont
// signalées à part (revenuMensuelAutresDevises) plutôt que sommées à tort.
export function SuperAdminDashboardPage() {
  const { session } = useAuth();
  const token = session?.accessToken;

  const stats = useQuery({
    queryKey: ['super-admin-stats'],
    queryFn: () => apiFetch<StatsGlobales>('/super-admin/stats', { token }),
  });

  if (stats.isPending) {
    return <p className="text-on-surface-variant">Chargement des statistiques…</p>;
  }
  if (stats.isError || !stats.data) {
    return <p className="text-error">Impossible de charger les statistiques.</p>;
  }

  const data = stats.data;
  const maxMensuel = Math.max(1, ...data.evolutionRevenusMensuels.map((m) => m.montant));
  const maxParPlan = Math.max(1, ...data.revenuParPlan.map((p) => p.montant));
  const totalParPlan = data.revenuParPlan.reduce((total, p) => total + p.montant, 0);
  const nbAlertes =
    data.alertes.paiementsEnRetard.length + data.alertes.licencesExpirantBientot.length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-on-background">Vue globale</h1>
        <p className="text-sm text-on-surface-variant">
          État de la plateforme, tous tenants confondus.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <p className="text-xs uppercase text-on-surface-variant flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-secondary">payments</span>
            Revenu mensuel
          </p>
          <p className="text-2xl font-bold text-on-background mt-1">
            {formaterMontant(data.revenuMensuel.montant, data.revenuMensuel.devise)}
          </p>
          {data.revenuMensuelAutresDevises.length > 0 && (
            <p className="text-xs text-on-surface-variant mt-1">
              +{' '}
              {data.revenuMensuelAutresDevises
                .map((entry) => formaterMontant(entry.montant, entry.devise))
                .join(', ')}
            </p>
          )}
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <p className="text-xs uppercase text-on-surface-variant flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-secondary">storefront</span>
            Tenants
          </p>
          <p className="text-2xl font-bold text-on-background mt-1">{data.totalTenants}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <p className="text-xs uppercase text-on-surface-variant flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-secondary">add_business</span>
            Nouveaux abonnements (mois)
          </p>
          <p className="text-2xl font-bold text-on-background mt-1">
            {data.nouveauxAbonnementsMois}
          </p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <p className="text-xs uppercase text-on-surface-variant flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-secondary">verified</span>
            Abonnements en règle
          </p>
          <p className="text-2xl font-bold text-on-background mt-1">{data.tauxRetention}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(LIBELLES_STATUT) as StatutLicence[]).map((statut) => (
          <div
            key={statut}
            className="bg-surface border border-outline-variant rounded-xl px-4 py-3 flex items-center justify-between"
          >
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${COULEURS_STATUT[statut]}`}
            >
              {LIBELLES_STATUT[statut]}
            </span>
            <span className="text-lg font-bold text-on-background">
              {data.repartitionLicences[statut]}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <div className="bg-surface border border-outline-variant rounded-xl p-4 sm:p-6">
          <h2 className="font-bold text-on-background mb-4">
            Revenus encaissés ({data.evolutionRevenusMensuels.length} mois)
          </h2>
          <div className="flex items-end gap-1.5 sm:gap-2.5 h-48 overflow-x-auto">
            {data.evolutionRevenusMensuels.map((entree, index) => {
              const [, mm] = entree.mois.split('-');
              const estDernier = index === data.evolutionRevenusMensuels.length - 1;
              return (
                <div
                  key={entree.mois}
                  className="flex-1 min-w-[24px] flex flex-col items-center justify-end h-full gap-1"
                  title={formaterMontant(entree.montant, data.revenuMensuel.devise)}
                >
                  <div
                    className={`w-full rounded-t ${estDernier ? 'bg-primary' : 'bg-primary/25'}`}
                    style={{ height: `${(entree.montant / maxMensuel) * 100}%`, minHeight: '2px' }}
                  />
                  <span className="text-[10px] text-on-surface-variant">
                    {LIBELLES_MOIS[mm ?? ''] ?? mm}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-surface border border-outline-variant rounded-xl p-4 sm:p-6">
          <h2 className="font-bold text-on-background mb-4">Revenu par plan</h2>
          <div className="flex flex-col gap-4">
            {data.revenuParPlan.map((entree) => (
              <div key={entree.plan}>
                <div className="flex items-baseline justify-between text-sm mb-1">
                  <span className="text-on-surface-variant">{LIBELLES_PLAN[entree.plan]}</span>
                  <span className="font-mono text-on-background">
                    {formaterMontant(entree.montant, data.revenuMensuel.devise)}
                    {totalParPlan > 0 && (
                      <span className="text-on-surface-variant">
                        {' '}
                        ({Math.round((entree.montant / totalParPlan) * 100)}%)
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${(entree.montant / maxParPlan) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
            <h2 className="font-bold text-on-background">Inscriptions récentes</h2>
            <Link to="/super-admin/tenants" className="text-sm text-primary underline">
              Voir tout
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-on-surface-variant">
                <th className="px-4 py-2">Pressing</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.inscriptionsRecentes.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-on-surface-variant" colSpan={5}>
                    Aucune inscription pour l'instant.
                  </td>
                </tr>
              )}
              {data.inscriptionsRecentes.map((tenant) => (
                <tr key={tenant.tenantId} className="border-t border-outline-variant">
                  <td className="px-4 py-2 font-medium text-on-surface">{tenant.nomPressing}</td>
                  <td className="px-4 py-2 text-on-surface-variant">
                    {formaterDate(tenant.createdAt)}
                  </td>
                  <td className="px-4 py-2">{LIBELLES_PLAN[tenant.plan]}</td>
                  <td className="px-4 py-2">
                    {tenant.statutLicence && (
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${COULEURS_STATUT[tenant.statutLicence]}`}
                      >
                        {LIBELLES_STATUT[tenant.statutLicence]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      to={`/super-admin/tenants/${tenant.tenantId}`}
                      className="text-primary underline text-xs"
                    >
                      Voir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-surface border border-outline-variant rounded-xl p-4 sm:p-6">
          <h2 className="font-bold text-on-background mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-alert-critical">warning</span>
            Alertes système
            {nbAlertes > 0 && (
              <span className="ml-auto bg-error-container text-on-error-container text-xs font-bold rounded-full px-2 py-0.5">
                {nbAlertes}
              </span>
            )}
          </h2>
          <div className="flex flex-col gap-3">
            {nbAlertes === 0 && (
              <p className="text-sm text-on-surface-variant">Aucune alerte active.</p>
            )}
            {data.alertes.paiementsEnRetard.map((alerte) => (
              <div
                key={alerte.tenantId}
                className="bg-error-container/20 border border-error/20 rounded-lg p-3"
              >
                <p className="text-sm font-semibold text-error">Paiement en retard</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  Tenant « {alerte.nomPressing} » — {formaterMontant(alerte.montant, alerte.devise)}
                  , depuis le {formaterDate(alerte.depuis)}.
                </p>
                <Link
                  to={`/super-admin/tenants/${alerte.tenantId}`}
                  className="text-xs text-primary underline mt-1 inline-block"
                >
                  Voir le tenant
                </Link>
              </div>
            ))}
            {data.alertes.licencesExpirantBientot.map((alerte) => (
              <div
                key={`${alerte.tenantId}-licence`}
                className="bg-status-pending/10 border border-status-pending/30 rounded-lg p-3"
              >
                <p className="text-sm font-semibold text-status-pending">Licence bientôt expirée</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  Tenant « {alerte.nomPressing} » — {LIBELLES_STATUT[alerte.statut]}, expire dans{' '}
                  {alerte.joursRestants} jour(s).
                </p>
                <Link
                  to={`/super-admin/tenants/${alerte.tenantId}`}
                  className="text-xs text-primary underline mt-1 inline-block"
                >
                  Voir le tenant
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
