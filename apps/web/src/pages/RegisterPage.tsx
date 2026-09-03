import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

const PAYS_OPTIONS = [
  'Sénégal',
  "Côte d'Ivoire",
  'Mali',
  'Cameroun',
  'Bénin',
  'Togo',
  'Burkina Faso',
  'Guinée',
  'Maroc',
  'France',
  'Autre',
];

const REGEX_SOUS_DOMAINE = /^[a-z0-9-]{3,63}$/;
const CHAMP_OBLIGATOIRE = 'Ce champ est obligatoire.';

type Champ = 'prenom' | 'nom' | 'email' | 'motDePasse' | 'nomPressing' | 'sousDomaine';
type Erreurs = Partial<Record<Champ | 'conditions', string>>;

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 35 26.9 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.6 5.1C9.6 39.6 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.6 5.6C41.9 35.8 44 30.3 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [afficherMotDePasse, setAfficherMotDePasse] = useState(false);
  const [nomPressing, setNomPressing] = useState('');
  const [sousDomaine, setSousDomaine] = useState('');
  const [pays, setPays] = useState('');
  const [conditionsAcceptees, setConditionsAcceptees] = useState(false);

  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const formulaireValide = useMemo(
    () =>
      prenom.trim().length > 0 &&
      nom.trim().length > 0 &&
      email.trim().length > 0 &&
      motDePasse.length >= 10 &&
      nomPressing.trim().length > 0 &&
      REGEX_SOUS_DOMAINE.test(sousDomaine) &&
      conditionsAcceptees,
    [prenom, nom, email, motDePasse, nomPressing, sousDomaine, conditionsAcceptees],
  );

  function champErreur(champ: Champ): string | undefined {
    switch (champ) {
      case 'prenom':
        return prenom.trim() ? undefined : CHAMP_OBLIGATOIRE;
      case 'nom':
        return nom.trim() ? undefined : CHAMP_OBLIGATOIRE;
      case 'email':
        return email.trim() ? undefined : CHAMP_OBLIGATOIRE;
      case 'nomPressing':
        return nomPressing.trim() ? undefined : CHAMP_OBLIGATOIRE;
      case 'sousDomaine':
        if (!sousDomaine.trim()) return CHAMP_OBLIGATOIRE;
        return REGEX_SOUS_DOMAINE.test(sousDomaine)
          ? undefined
          : 'Minuscules, chiffres et tirets uniquement (3 à 63 caractères).';
      case 'motDePasse':
        if (!motDePasse) return CHAMP_OBLIGATOIRE;
        return motDePasse.length >= 10
          ? undefined
          : 'Le mot de passe doit contenir au moins 10 caractères.';
      default:
        return undefined;
    }
  }

  function validerChamps(): Erreurs {
    const next: Erreurs = {};
    (['prenom', 'nom', 'email', 'nomPressing', 'sousDomaine', 'motDePasse'] as const).forEach(
      (champ) => {
        const message = champErreur(champ);
        if (message) next[champ] = message;
      },
    );
    if (!conditionsAcceptees) {
      next.conditions = 'Vous devez accepter les conditions pour créer votre compte.';
    }
    return next;
  }

  function handleBlur(champ: Champ) {
    setErreurs((prev) => ({ ...prev, [champ]: champErreur(champ) }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErreurServeur(null);
    const prochainesErreurs = validerChamps();
    setErreurs(prochainesErreurs);
    if (Object.keys(prochainesErreurs).length > 0) {
      return;
    }

    setEnCours(true);
    try {
      await register({
        prenom,
        nom,
        email,
        motDePasse,
        nomPressing,
        sousDomaine,
        ...(pays ? { pays } : {}),
      });
      navigate('/');
    } catch (error) {
      if (error instanceof ApiError && error.status < 500) {
        setErreurServeur(error.message);
      } else {
        setErreurServeur('Une erreur est survenue. Veuillez réessayer.');
      }
    } finally {
      setEnCours(false);
    }
  }

  function handleGoogleSignup() {
    window.location.href = `${API_BASE_URL}/auth/google`;
  }

  return (
    <div className="min-h-screen bg-surface-container-low">
      <header className="flex items-center justify-center border-b border-outline-variant bg-surface px-4 py-4 sm:justify-start sm:px-8">
        <span className="text-lg font-bold text-primary">Fotall-Ma Pro</span>
      </header>

      <main className="flex justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-[480px]">
          <div className="rounded-2xl border border-outline-variant bg-surface p-6 shadow-sm sm:p-9">
            <h1 className="text-2xl font-bold text-on-surface">Créez votre compte</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Commencez gratuitement avec Fotall-Ma Pro.
            </p>

            <button
              type="button"
              onClick={handleGoogleSignup}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-outline-variant bg-surface py-2.5 text-sm font-medium text-on-surface shadow-sm transition hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <GoogleLogo />
              S'inscrire avec Google
            </button>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-outline-variant" />
              <span className="text-xs text-on-surface-variant">ou avec votre email</span>
              <span className="h-px flex-1 bg-outline-variant" />
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <label className="flex flex-1 flex-col gap-1 text-sm" htmlFor="prenom">
                  Prénom
                  <input
                    id="prenom"
                    className="rounded-lg border border-outline-variant px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    value={prenom}
                    onChange={(event) => setPrenom(event.target.value)}
                    onBlur={() => handleBlur('prenom')}
                    aria-invalid={Boolean(erreurs.prenom)}
                    aria-describedby={erreurs.prenom ? 'prenom-erreur' : undefined}
                  />
                  {erreurs.prenom && (
                    <span id="prenom-erreur" className="text-xs text-error">
                      {erreurs.prenom}
                    </span>
                  )}
                </label>
                <label className="flex flex-1 flex-col gap-1 text-sm" htmlFor="nom">
                  Nom
                  <input
                    id="nom"
                    className="rounded-lg border border-outline-variant px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    value={nom}
                    onChange={(event) => setNom(event.target.value)}
                    onBlur={() => handleBlur('nom')}
                    aria-invalid={Boolean(erreurs.nom)}
                    aria-describedby={erreurs.nom ? 'nom-erreur' : undefined}
                  />
                  {erreurs.nom && (
                    <span id="nom-erreur" className="text-xs text-error">
                      {erreurs.nom}
                    </span>
                  )}
                </label>
              </div>

              <label className="flex flex-col gap-1 text-sm" htmlFor="email">
                Email
                <input
                  id="email"
                  type="email"
                  className="rounded-lg border border-outline-variant px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onBlur={() => handleBlur('email')}
                  aria-invalid={Boolean(erreurs.email)}
                  aria-describedby={erreurs.email ? 'email-erreur' : undefined}
                />
                {erreurs.email && (
                  <span id="email-erreur" className="text-xs text-error">
                    {erreurs.email}
                  </span>
                )}
              </label>

              <div className="flex flex-col gap-1 text-sm">
                <label htmlFor="mot-de-passe">Mot de passe</label>
                <span className="relative flex items-center">
                  <input
                    id="mot-de-passe"
                    type={afficherMotDePasse ? 'text' : 'password'}
                    className="w-full rounded-lg border border-outline-variant px-3 py-2 pr-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    value={motDePasse}
                    onChange={(event) => setMotDePasse(event.target.value)}
                    onBlur={() => handleBlur('motDePasse')}
                    aria-invalid={Boolean(erreurs.motDePasse)}
                    aria-describedby="mot-de-passe-aide"
                  />
                  <button
                    type="button"
                    onClick={() => setAfficherMotDePasse((valeur) => !valeur)}
                    aria-label={
                      afficherMotDePasse
                        ? 'Masquer le mot de passe'
                        : 'Afficher le mot de passe'
                    }
                    className="material-symbols-outlined absolute right-2 text-on-surface-variant"
                  >
                    {afficherMotDePasse ? 'visibility_off' : 'visibility'}
                  </button>
                </span>
                <span
                  id="mot-de-passe-aide"
                  className={`text-xs ${erreurs.motDePasse ? 'text-error' : 'text-on-surface-variant'}`}
                >
                  {erreurs.motDePasse ?? 'Minimum 10 caractères.'}
                </span>
              </div>

              <label className="flex flex-col gap-1 text-sm" htmlFor="nom-pressing">
                Nom du pressing
                <input
                  id="nom-pressing"
                  className="rounded-lg border border-outline-variant px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  value={nomPressing}
                  onChange={(event) => setNomPressing(event.target.value)}
                  onBlur={() => handleBlur('nomPressing')}
                  aria-invalid={Boolean(erreurs.nomPressing)}
                  aria-describedby={erreurs.nomPressing ? 'nom-pressing-erreur' : undefined}
                />
                {erreurs.nomPressing && (
                  <span id="nom-pressing-erreur" className="text-xs text-error">
                    {erreurs.nomPressing}
                  </span>
                )}
              </label>

              <label className="flex flex-col gap-1 text-sm" htmlFor="sous-domaine">
                Sous-domaine
                <input
                  id="sous-domaine"
                  className="rounded-lg border border-outline-variant px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  placeholder="mon-pressing"
                  value={sousDomaine}
                  onChange={(event) => setSousDomaine(event.target.value.toLowerCase())}
                  onBlur={() => handleBlur('sousDomaine')}
                  aria-invalid={Boolean(erreurs.sousDomaine)}
                  aria-describedby={erreurs.sousDomaine ? 'sous-domaine-erreur' : undefined}
                />
                {erreurs.sousDomaine && (
                  <span id="sous-domaine-erreur" className="text-xs text-error">
                    {erreurs.sousDomaine}
                  </span>
                )}
              </label>

              <label className="flex flex-col gap-1 text-sm" htmlFor="pays">
                Pays
                <select
                  id="pays"
                  className="rounded-lg border border-outline-variant bg-surface px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  value={pays}
                  onChange={(event) => setPays(event.target.value)}
                >
                  <option value="">Sélectionner (optionnel)</option>
                  {PAYS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={conditionsAcceptees}
                  onChange={(event) => setConditionsAcceptees(event.target.checked)}
                  aria-invalid={Boolean(erreurs.conditions)}
                  aria-describedby={erreurs.conditions ? 'conditions-erreur' : undefined}
                />
                <span className="text-on-surface-variant">
                  J'accepte les{' '}
                  <Link className="text-primary underline" to="/cgu">
                    conditions générales d'utilisation
                  </Link>{' '}
                  et la{' '}
                  <Link className="text-primary underline" to="/confidentialite">
                    politique de confidentialité
                  </Link>
                  .
                </span>
              </label>
              {erreurs.conditions && (
                <span id="conditions-erreur" className="-mt-2 text-xs text-error">
                  {erreurs.conditions}
                </span>
              )}

              {erreurServeur && (
                <p role="alert" className="text-sm text-error">
                  {erreurServeur}
                </p>
              )}

              <button
                type="submit"
                disabled={enCours || !formulaireValide}
                className="mt-2 rounded-lg bg-primary py-2.5 font-medium text-on-primary transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enCours ? 'Création…' : 'Créer mon compte'}
              </button>
            </form>

            <p className="mt-6 text-sm text-on-surface-variant">
              Vous avez déjà un compte ?{' '}
              <Link className="text-primary underline" to="/connexion">
                Se connecter
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-on-surface-variant">
            Gestion professionnelle de votre pressing, lavage auto et activité de nettoyage.
          </p>
        </div>
      </main>
    </div>
  );
}
