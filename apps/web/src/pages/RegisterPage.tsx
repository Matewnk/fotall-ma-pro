import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [nomPressing, setNomPressing] = useState('');
  const [sousDomaine, setSousDomaine] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await register(nomPressing, sousDomaine, email, motDePasse);
      navigate('/');
    } catch (error) {
      setErreur(error instanceof ApiError ? error.message : 'Inscription impossible.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-low px-4">
      <div className="w-full max-w-sm bg-surface border border-outline-variant rounded-xl p-8 shadow-sm">
        <h1 className="text-xl font-bold text-primary mb-1">Fotall-Ma Pro</h1>
        <p className="text-sm text-on-surface-variant mb-6">
          Créer votre pressing — essai gratuit de 15 jours
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Nom du pressing
            <input
              className="border border-outline-variant rounded-lg px-3 py-2"
              value={nomPressing}
              onChange={(event) => setNomPressing(event.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Sous-domaine
            <input
              className="border border-outline-variant rounded-lg px-3 py-2"
              placeholder="mon-pressing"
              value={sousDomaine}
              onChange={(event) => setSousDomaine(event.target.value)}
              required
            />
          </label>
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
            Mot de passe
            <input
              type="password"
              minLength={8}
              className="border border-outline-variant rounded-lg px-3 py-2"
              value={motDePasse}
              onChange={(event) => setMotDePasse(event.target.value)}
              required
            />
          </label>

          {erreur && <p className="text-sm text-error">{erreur}</p>}

          <button
            type="submit"
            disabled={enCours}
            className="mt-2 bg-primary text-on-primary rounded-lg py-2 font-medium disabled:opacity-60"
          >
            {enCours ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="mt-6 text-sm text-on-surface-variant">
          Déjà un compte ?{' '}
          <Link className="text-primary underline" to="/connexion">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
