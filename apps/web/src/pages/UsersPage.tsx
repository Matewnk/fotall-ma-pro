import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { Role } from '@fotall/shared-types';

type Utilisateur = {
  id: string;
  email: string;
  role: Role;
  actif: boolean;
  createdAt: string;
};

const ROLES_GERABLES: Role[] = ['ADMIN', 'CAISSIER', 'TECHNICIEN', 'LIVREUR'];

const LIBELLES_ROLE: Record<Role, string> = {
  SUPER_ADMIN: 'Super-admin',
  ADMIN: 'Administrateur',
  CAISSIER: 'Caissier',
  TECHNICIEN: 'Technicien',
  LIVREUR: 'Livreur',
};

// Écran §015-web tranche 5 (administration/utilisateurs) — maquette de
// référence : docs/design/screens/gestion_des_utilisateurs_et_r_les.
// Nouveau backend nécessaire (users/*, aucun n'existait jusqu'ici) — voir
// spec.md. "Dernière connexion" de la maquette non repris (aucun champ de
// ce type sur User).
export function UsersPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const moiId = session?.user.id;
  const queryClient = useQueryClient();
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [role, setRole] = useState<Role>('CAISSIER');
  const [erreur, setErreur] = useState<string | null>(null);

  const utilisateurs = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<Utilisateur[]>('/users', { token }),
  });

  const creerUtilisateur = useMutation({
    mutationFn: () =>
      apiFetch<Utilisateur>('/users', {
        method: 'POST',
        token,
        body: { email, motDePasse, role },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setFormulaireOuvert(false);
      setEmail('');
      setMotDePasse('');
      setRole('CAISSIER');
      setErreur(null);
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Création impossible.');
    },
  });

  const changerRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      apiFetch<Utilisateur>(`/users/${id}`, { method: 'PATCH', token, body: { role } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const changerStatut = useMutation({
    mutationFn: ({ id, actif }: { id: string; actif: boolean }) =>
      apiFetch<Utilisateur>(`/users/${id}`, { method: 'PATCH', token, body: { actif } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const reinitialiserMotDePasse = useMutation({
    mutationFn: ({ id, motDePasse }: { id: string; motDePasse: string }) =>
      apiFetch<{ ok: true }>(`/users/${id}/mot-de-passe`, {
        method: 'PATCH',
        token,
        body: { motDePasse },
      }),
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Réinitialisation impossible.');
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    creerUtilisateur.mutate();
  }

  function handleReinitialiserMotDePasse(utilisateur: Utilisateur) {
    const nouveauMotDePasse = window.prompt(
      `Nouveau mot de passe pour ${utilisateur.email} (8 caractères minimum) :`,
    );
    if (!nouveauMotDePasse) {
      return;
    }
    setErreur(null);
    reinitialiserMotDePasse.mutate({ id: utilisateur.id, motDePasse: nouveauMotDePasse });
  }

  const actifs = utilisateurs.data?.filter((u) => u.actif).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-background">Utilisateurs</h1>
          <p className="text-sm text-on-surface-variant">{actifs} compte(s) actif(s)</p>
        </div>
        <button
          type="button"
          onClick={() => setFormulaireOuvert((ouvert) => !ouvert)}
          className="flex items-center gap-2 bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-medium"
        >
          <span className="material-symbols-outlined">person_add</span>
          Nouvel utilisateur
        </button>
      </div>

      {formulaireOuvert && (
        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input
                type="email"
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Mot de passe provisoire
              <input
                type="password"
                minLength={8}
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={motDePasse}
                onChange={(event) => setMotDePasse(event.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Rôle
              <select
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
              >
                {ROLES_GERABLES.map((r) => (
                  <option key={r} value={r}>
                    {LIBELLES_ROLE[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {erreur && <p className="text-sm text-error">{erreur}</p>}

          <button
            type="submit"
            disabled={creerUtilisateur.isPending}
            className="self-start bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {creerUtilisateur.isPending ? 'Création…' : "Créer l'utilisateur"}
          </button>
        </form>
      )}

      {!formulaireOuvert && erreur && <p className="text-sm text-error">{erreur}</p>}

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-on-surface-variant">
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Rôle</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {utilisateurs.isPending && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={4}>
                  Chargement…
                </td>
              </tr>
            )}
            {utilisateurs.data?.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={4}>
                  Aucun utilisateur pour l'instant.
                </td>
              </tr>
            )}
            {utilisateurs.data?.map((utilisateur) => (
              <tr key={utilisateur.id} className="border-t border-outline-variant">
                <td className="px-4 py-2">{utilisateur.email}</td>
                <td className="px-4 py-2">
                  <select
                    className="border border-outline-variant rounded-lg px-2 py-1 text-xs"
                    value={utilisateur.role}
                    disabled={utilisateur.role === 'SUPER_ADMIN'}
                    onChange={(event) =>
                      changerRole.mutate({ id: utilisateur.id, role: event.target.value as Role })
                    }
                  >
                    {utilisateur.role === 'SUPER_ADMIN' && (
                      <option value="SUPER_ADMIN">{LIBELLES_ROLE.SUPER_ADMIN}</option>
                    )}
                    {ROLES_GERABLES.map((r) => (
                      <option key={r} value={r}>
                        {LIBELLES_ROLE[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                      utilisateur.actif
                        ? 'bg-status-delivered/10 text-status-delivered'
                        : 'bg-status-pending/10 text-status-pending'
                    }`}
                  >
                    {utilisateur.actif ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleReinitialiserMotDePasse(utilisateur)}
                      className="text-primary text-xs font-medium"
                    >
                      Réinitialiser mot de passe
                    </button>
                    {utilisateur.id !== moiId && (
                      <button
                        type="button"
                        onClick={() =>
                          changerStatut.mutate({ id: utilisateur.id, actif: !utilisateur.actif })
                        }
                        className={`text-xs font-medium ${utilisateur.actif ? 'text-error' : 'text-primary'}`}
                      >
                        {utilisateur.actif ? 'Désactiver' : 'Réactiver'}
                      </button>
                    )}
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
