import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { EvenementPlateforme } from '../lib/types';

const LIBELLES_ACTION: Record<string, string> = {
  CREATION: 'Création',
  ACTIVATION: 'Activation',
  RENOUVELLEMENT: 'Renouvellement',
  SUSPENSION: 'Suspension',
  REACTIVATION: 'Réactivation',
  REVOCATION: 'Révocation',
  EXPIRATION_AUTOMATIQUE: 'Expiration automatique',
  SESSION_SUPPORT_DEMARREE: 'Session support démarrée',
  SESSION_SUPPORT_TERMINEE: 'Session support terminée',
};

const COULEURS_TYPE: Record<string, string> = {
  LICENCE: 'bg-secondary-container text-on-secondary-container',
  SUPPORT: 'bg-status-progress/10 text-status-progress',
};

// Écran §022-super-admin-enhancement — "Audit & Sécurité". Résolution de la
// contradiction H1 documentée dans l'audit initial : plutôt que de
// contourner audit.controller.ts (qui refuse tout accès Super-Admin à
// l'AuditLog métier d'un tenant sans session support active), cette page
// n'affiche que les évènements qui appartiennent réellement au
// control-plane et au périmètre Super-Admin — cycle de vie des licences et
// accès en mode support. Jamais de secret : ni JWT, ni mot de passe, ni
// token, ni clé — ces modèles n'en stockent pas.
export function SuperAdminAuditPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [recherche, setRecherche] = useState('');
  const [filtreType, setFiltreType] = useState<'' | 'LICENCE' | 'SUPPORT'>('');

  const evenements = useQuery({
    queryKey: ['super-admin-audit'],
    queryFn: () => apiFetch<EvenementPlateforme[]>('/super-admin/audit', { token }),
  });

  const evenementsAffiches = useMemo(() => {
    const rechercheNormalisee = recherche.trim().toLocaleLowerCase('fr-FR');
    return (evenements.data ?? []).filter((evenement) => {
      const correspondRecherche =
        rechercheNormalisee === '' ||
        evenement.nomPressing.toLocaleLowerCase('fr-FR').includes(rechercheNormalisee) ||
        (evenement.motif?.toLocaleLowerCase('fr-FR').includes(rechercheNormalisee) ?? false);
      const correspondType = filtreType === '' || evenement.type === filtreType;
      return correspondRecherche && correspondType;
    });
  }, [evenements.data, recherche, filtreType]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-on-background">Audit &amp; Sécurité</h1>
        <p className="text-sm text-on-surface-variant">
          Cycle de vie des licences et accès en mode support, tous tenants confondus — jamais les
          données métier d'un tenant (voir mode support par tenant pour ça).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="relative w-full max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            type="search"
            aria-label="Rechercher un évènement"
            placeholder="Rechercher (tenant, motif)…"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            className="w-full border border-outline-variant rounded-lg pl-10 pr-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Type
          <select
            value={filtreType}
            onChange={(event) => setFiltreType(event.target.value as '' | 'LICENCE' | 'SUPPORT')}
            className="border border-outline-variant rounded-lg px-3 py-2"
          >
            <option value="">Tous</option>
            <option value="LICENCE">Licence</option>
            <option value="SUPPORT">Support</option>
          </select>
        </label>
      </div>

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-on-surface-variant">
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Tenant</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Motif</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {evenements.isPending && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={6}>
                  Chargement…
                </td>
              </tr>
            )}
            {!evenements.isPending && evenementsAffiches.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={6}>
                  Aucun évènement ne correspond à la recherche.
                </td>
              </tr>
            )}
            {evenementsAffiches.map((evenement) => (
              <tr
                key={`${evenement.type}-${evenement.id}`}
                className="border-t border-outline-variant"
              >
                <td className="px-4 py-2 text-on-surface-variant">
                  {new Date(evenement.createdAt).toLocaleString('fr-FR')}
                </td>
                <td className="px-4 py-2 font-medium text-on-surface">{evenement.nomPressing}</td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${COULEURS_TYPE[evenement.type]}`}
                  >
                    {evenement.type === 'LICENCE' ? 'Licence' : 'Support'}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  {LIBELLES_ACTION[evenement.action] ?? evenement.action}
                </td>
                <td className="px-4 py-2 text-on-surface-variant">{evenement.motif ?? '—'}</td>
                <td className="px-4 py-2">
                  <Link
                    to={`/super-admin/tenants/${evenement.tenantId}`}
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
