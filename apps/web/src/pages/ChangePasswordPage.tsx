import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { Session } from '../lib/types';

// Écran de changement de mot de passe obligatoire — affiché en routage
// forcé quand session.user.mustChangePassword est actif (voir App.tsx),
// notamment après une réinitialisation par le SUPER_ADMIN. L'ancien mot
// de passe (le mot de passe temporaire fourni par le Super-Admin) doit
// être fourni : c'est le seul flux de changement où l'utilisateur prouve
// lui-même son mot de passe actuel (voir AuthService#changerMotDePasse).
export function ChangePasswordPage() {
  const { session, updateSession, logout } = useAuth();
  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [motDePasseNouveau, setMotDePasseNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErreur(null);

    if (motDePasseNouveau !== confirmation) {
      setErreur('La confirmation ne correspond pas.');
      return;
    }

    setEnCours(true);
    try {
      const resultat = await apiFetch<Session>('/auth/mot-de-passe', {
        method: 'PATCH',
        token: session?.accessToken,
        body: { motDePasseActuel, motDePasseNouveau },
      });
      updateSession(resultat);
    } catch (error) {
      setErreur(error instanceof ApiError ? error.message : 'Le changement a échoué.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-low px-4">
      <div className="w-full max-w-sm bg-surface border border-outline-variant rounded-xl p-8 shadow-sm">
        <h1 className="text-xl font-bold text-primary mb-1">Mot de passe à changer</h1>
        <p className="text-sm text-on-surface-variant mb-6">
          Votre mot de passe a été réinitialisé. Choisissez un nouveau mot de passe pour continuer.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Mot de passe temporaire
            <input
              type="password"
              className="border border-outline-variant rounded-lg px-3 py-2"
              value={motDePasseActuel}
              onChange={(event) => setMotDePasseActuel(event.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Nouveau mot de passe
            <input
              type="password"
              className="border border-outline-variant rounded-lg px-3 py-2"
              value={motDePasseNouveau}
              onChange={(event) => setMotDePasseNouveau(event.target.value)}
              minLength={8}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Confirmer le nouveau mot de passe
            <input
              type="password"
              className="border border-outline-variant rounded-lg px-3 py-2"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              minLength={8}
              required
            />
          </label>

          {erreur && <p className="text-sm text-error">{erreur}</p>}

          <button
            type="submit"
            disabled={enCours}
            className="mt-2 bg-primary text-on-primary rounded-lg py-2 font-medium disabled:opacity-60"
          >
            {enCours ? 'Changement…' : 'Changer mon mot de passe'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="text-sm text-on-surface-variant hover:underline"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}
