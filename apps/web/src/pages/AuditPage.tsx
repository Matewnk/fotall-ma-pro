import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { EntreeAudit } from '../lib/types';

// Écran §018 (audit/logs) — maquette de référence :
// docs/design/screens/audit_de_s_curit_et_logs_utilisateurs. Contrairement
// aux écrans super-admin voisins de cette tranche, GET /audit est
// tenant-scoped (audit.controller.ts : exige un tenantId, jamais un accès
// SUPER_ADMIN direct — celui-ci doit passer par le mode support explicite,
// voir SuperAdminTenantDetailPage). Écran ADMIN, sur AppShell.
export function AuditPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [filtreAction, setFiltreAction] = useState('');

  const entrees = useQuery({
    queryKey: ['audit', filtreAction],
    queryFn: () =>
      apiFetch<EntreeAudit[]>(
        `/audit${filtreAction ? `?action=${encodeURIComponent(filtreAction)}` : ''}`,
        { token },
      ),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-on-background">Journal d'audit</h1>
        <p className="text-sm text-on-surface-variant">
          Actions sensibles enregistrées pour ce tenant (Constitution VII).
        </p>
      </div>

      <input
        type="search"
        placeholder="Filtrer par action (ex : TENANT_PLAN_MODIFIE)…"
        value={filtreAction}
        onChange={(event) => setFiltreAction(event.target.value)}
        className="border border-outline-variant rounded-lg px-3 py-2 text-sm max-w-sm"
      />

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-on-surface-variant">
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Entité</th>
              <th className="px-4 py-2">Auteur</th>
            </tr>
          </thead>
          <tbody>
            {entrees.isPending && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={4}>
                  Chargement…
                </td>
              </tr>
            )}
            {entrees.data?.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={4}>
                  Aucune entrée d'audit pour l'instant.
                </td>
              </tr>
            )}
            {entrees.data?.map((entree) => (
              <tr key={entree.id} className="border-t border-outline-variant">
                <td className="px-4 py-2 text-on-surface-variant text-xs">
                  {new Date(entree.createdAt).toLocaleString('fr-FR')}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{entree.action}</td>
                <td className="px-4 py-2">
                  {entree.entityType}{' '}
                  <span className="text-on-surface-variant">#{entree.entityId}</span>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{entree.actorId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
