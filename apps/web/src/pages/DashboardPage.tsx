import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { KpiCard } from '../components/KpiCard';
import { StatusBadge } from '../components/StatusBadge';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { Dashboard } from '../lib/types';

export function DashboardPage() {
  const { session } = useAuth();
  const { data, isPending, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<Dashboard>('/dashboard', { token: session?.accessToken }),
  });

  if (isPending) {
    return <p className="text-on-surface-variant">Chargement du tableau de bord…</p>;
  }
  if (isError || !data) {
    return <p className="text-error">Impossible de charger le tableau de bord.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {data.alertes.licenceProcheExpiration.active && (
        <div className="bg-error-container text-on-error-container p-4 rounded-xl flex items-start gap-3 border border-error/20">
          <span className="material-symbols-outlined text-alert-critical">warning</span>
          <div>
            <h4 className="font-bold text-sm">Essai bientôt terminé</h4>
            <p className="text-sm mt-1">
              Il reste {data.alertes.licenceProcheExpiration.joursRestants} jour(s) avant la fin de
              votre essai gratuit.
            </p>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-on-background">Tableau de bord</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Commandes du jour" value={data.kpis.commandesDuJour} icon="receipt_long" />
        <KpiCard
          label="Chiffre d'affaires du jour"
          value={`${data.kpis.chiffreAffairesDuJour} FCFA`}
          icon="payments"
        />
        <KpiCard
          label="Articles en attente"
          value={data.kpis.articlesEnAttente}
          icon="inventory_2"
        />
        <KpiCard
          label="Livraisons prévues"
          value={data.kpis.livraisonsPrevuesAujourdHui}
          icon="local_shipping"
        />
        <KpiCard
          label="Commandes en retard"
          value={data.kpis.commandesEnRetard}
          icon="schedule"
          alerte={data.kpis.commandesEnRetard > 0}
        />
        <KpiCard
          label="Paiements en attente"
          value={data.alertes.paiementsEnAttente}
          icon="account_balance_wallet"
          alerte={data.alertes.paiementsEnAttente > 0}
        />
      </div>

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
          <h2 className="font-bold text-on-background">Commandes récentes</h2>
          <Link to="/commandes" className="text-sm text-primary underline">
            Voir tout
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-on-surface-variant">
                <th className="px-4 py-2">Numéro</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Montant</th>
                <th className="px-4 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {data.commandesRecentes.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-on-surface-variant" colSpan={4}>
                    Aucune commande pour l'instant.
                  </td>
                </tr>
              )}
              {data.commandesRecentes.map((commande) => (
                <tr key={commande.numero} className="border-t border-outline-variant">
                  <td className="px-4 py-2 font-mono">#{commande.numero}</td>
                  <td className="px-4 py-2">{commande.client.nom}</td>
                  <td className="px-4 py-2">{commande.montant} FCFA</td>
                  <td className="px-4 py-2">
                    <StatusBadge statut={commande.statut} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
