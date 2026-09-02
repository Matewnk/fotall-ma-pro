import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { UtilisateurGlobal } from '../lib/types';

const ROLES: string[] = ['ADMIN', 'CAISSIER', 'TECHNICIEN', 'LIVREUR'];

const LIBELLES_ROLE: Record<string, string> = {
  ADMIN: 'Admin',
  CAISSIER: 'Caissier',
  TECHNICIEN: 'Technicien',
  LIVREUR: 'Livreur',
};

// Écran §022-super-admin-enhancement — vue globale des utilisateurs, tous
// tenants confondus. Lecture seule : le SUPER_ADMIN n'obtient ici aucun
// droit métier nouveau, GET /super-admin/utilisateurs ne renvoie que des
// comptes tenant-scoped (jamais les autres comptes SUPER_ADMIN, cf.
// users.controller.ts). Pas de colonne "dernière connexion" : aucune donnée
// de ce type n'existe côté API (voir tenants.controller.ts, même limitation
// documentée).
export function SuperAdminUsersPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [recherche, setRecherche] = useState('');
  const [filtreRole, setFiltreRole] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');

  const utilisateurs = useQuery({
    queryKey: ['super-admin-utilisateurs'],
    queryFn: () => apiFetch<UtilisateurGlobal[]>('/super-admin/utilisateurs', { token }),
  });

  const utilisateursAffiches = useMemo(() => {
    const rechercheNormalisee = recherche.trim().toLocaleLowerCase('fr-FR');
    return (utilisateurs.data ?? []).filter((utilisateur) => {
      const correspondRecherche =
        rechercheNormalisee === '' ||
        utilisateur.email.toLocaleLowerCase('fr-FR').includes(rechercheNormalisee) ||
        utilisateur.tenant.nomPressing.toLocaleLowerCase('fr-FR').includes(rechercheNormalisee);
      const correspondRole = filtreRole === '' || utilisateur.role === filtreRole;
      const correspondStatut =
        filtreStatut === '' || (filtreStatut === 'ACTIF' ? utilisateur.actif : !utilisateur.actif);
      return correspondRecherche && correspondRole && correspondStatut;
    });
  }, [utilisateurs.data, recherche, filtreRole, filtreStatut]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-on-background">Utilisateurs</h1>
        <p className="text-sm text-on-surface-variant">
          {utilisateursAffiches.length} / {utilisateurs.data?.length ?? 0} utilisateur(s) sur la
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
            aria-label="Rechercher un utilisateur"
            placeholder="Rechercher un utilisateur (email, tenant)…"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            className="w-full border border-outline-variant rounded-lg pl-10 pr-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Rôle
          <select
            value={filtreRole}
            onChange={(event) => setFiltreRole(event.target.value)}
            className="border border-outline-variant rounded-lg px-3 py-2"
          >
            <option value="">Tous</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {LIBELLES_ROLE[role]}
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
            <option value="ACTIF">Actif</option>
            <option value="INACTIF">Inactif</option>
          </select>
        </label>
      </div>

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-on-surface-variant">
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Tenant</th>
              <th className="px-4 py-2">Rôle</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Créé le</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {utilisateurs.isPending && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={6}>
                  Chargement…
                </td>
              </tr>
            )}
            {!utilisateurs.isPending && utilisateursAffiches.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={6}>
                  Aucun utilisateur ne correspond à la recherche.
                </td>
              </tr>
            )}
            {utilisateursAffiches.map((utilisateur) => (
              <tr key={utilisateur.id} className="border-t border-outline-variant">
                <td className="px-4 py-2 font-medium text-on-surface">{utilisateur.email}</td>
                <td className="px-4 py-2 text-on-surface-variant">
                  {utilisateur.tenant.nomPressing}
                </td>
                <td className="px-4 py-2">{LIBELLES_ROLE[utilisateur.role] ?? utilisateur.role}</td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                      utilisateur.actif
                        ? 'bg-status-delivered/10 text-status-delivered'
                        : 'bg-error/10 text-error'
                    }`}
                  >
                    {utilisateur.actif ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-4 py-2 text-on-surface-variant">
                  {new Date(utilisateur.createdAt).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-2">
                  <Link
                    to={`/super-admin/tenants/${utilisateur.tenant.id}`}
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
