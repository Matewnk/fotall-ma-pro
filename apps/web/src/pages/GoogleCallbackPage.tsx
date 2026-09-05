import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { Session } from '../lib/types';

const ERREUR_GOOGLE = 'Impossible de créer votre compte avec Google. Veuillez réessayer.';
const REGEX_SOUS_DOMAINE = /^[a-z0-9-]{3,63}$/;
const CHAMP_OBLIGATOIRE = 'Ce champ est obligatoire.';

type ResultatEchange = { type: 'session'; session: Session } | { type: 'ticket'; ticket: string };

// Atterrissage après GET /auth/google/callback : le backend n'a jamais
// exposé de JWT/ticket dans cette URL, seulement un code d'échange à usage
// unique (voir google-exchange.service.ts) — cette page l'échange
// immédiatement contre soit une session réelle (compte Google déjà connu),
// soit un ticket à finaliser (nouveau compte, nomPressing/sousDomaine
// restent à fournir).
export function GoogleCallbackPage() {
  const { updateSession, registerGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const erreurParam = searchParams.get('erreur');

  const [statut, setStatut] = useState<'chargement' | 'erreur' | 'finalisation'>('chargement');
  const [ticket, setTicket] = useState<string | null>(null);

  const [nomPressing, setNomPressing] = useState('');
  const [sousDomaine, setSousDomaine] = useState('');
  const [pays, setPays] = useState('');
  const [erreurs, setErreurs] = useState<{ nomPressing?: string; sousDomaine?: string }>({});
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const formulaireValide = useMemo(
    () => nomPressing.trim().length > 0 && REGEX_SOUS_DOMAINE.test(sousDomaine),
    [nomPressing, sousDomaine],
  );

  useEffect(() => {
    if (erreurParam) {
      setStatut('erreur');
      return;
    }
    if (!code) {
      setStatut('erreur');
      return;
    }
    let annule = false;
    apiFetch<ResultatEchange>('/auth/google/exchange', { method: 'POST', body: { code } })
      .then((resultat) => {
        if (annule) return;
        if (resultat.type === 'session') {
          updateSession(resultat.session);
          navigate('/');
          return;
        }
        setTicket(resultat.ticket);
        setStatut('finalisation');
      })
      .catch(() => {
        if (!annule) setStatut('erreur');
      });
    return () => {
      annule = true;
    };
  }, [code, erreurParam, navigate, updateSession]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ticket) return;
    setErreurServeur(null);
    const next: { nomPressing?: string; sousDomaine?: string } = {};
    if (!nomPressing.trim()) next.nomPressing = CHAMP_OBLIGATOIRE;
    if (!sousDomaine.trim()) {
      next.sousDomaine = CHAMP_OBLIGATOIRE;
    } else if (!REGEX_SOUS_DOMAINE.test(sousDomaine)) {
      next.sousDomaine = 'Minuscules, chiffres et tirets uniquement (3 à 63 caractères).';
    }
    setErreurs(next);
    if (Object.keys(next).length > 0) return;

    setEnCours(true);
    try {
      await registerGoogle({ ticket, nomPressing, sousDomaine, ...(pays ? { pays } : {}) });
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

  return (
    <div className="min-h-screen bg-surface-container-low">
      <header className="flex items-center justify-center border-b border-outline-variant bg-surface px-4 py-4 sm:justify-start sm:px-8">
        <span className="text-lg font-bold text-primary">Fotall-Ma Pro</span>
      </header>

      <main className="flex justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-[480px]">
          <div className="rounded-2xl border border-outline-variant bg-surface p-6 shadow-sm sm:p-9">
            {statut === 'chargement' && (
              <p className="text-sm text-on-surface-variant">Connexion à Google en cours…</p>
            )}

            {statut === 'erreur' && (
              <>
                <h1 className="text-xl font-bold text-on-surface">Connexion Google impossible</h1>
                <p role="alert" className="mt-2 text-sm text-error">
                  {ERREUR_GOOGLE}
                </p>
                <Link
                  className="mt-6 inline-block text-sm text-primary underline"
                  to="/inscription"
                >
                  Retour à l'inscription
                </Link>
              </>
            )}

            {statut === 'finalisation' && (
              <>
                <h1 className="text-xl font-bold text-on-surface">Presque terminé</h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Renseignez les informations de votre pressing pour finaliser la création du
                  compte.
                </p>

                <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
                  <label className="flex flex-col gap-1 text-sm" htmlFor="nom-pressing">
                    Nom du pressing
                    <input
                      id="nom-pressing"
                      className="rounded-lg border border-outline-variant px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      value={nomPressing}
                      onChange={(event) => setNomPressing(event.target.value)}
                      aria-invalid={Boolean(erreurs.nomPressing)}
                    />
                    {erreurs.nomPressing && (
                      <span className="text-xs text-error">{erreurs.nomPressing}</span>
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
                      aria-invalid={Boolean(erreurs.sousDomaine)}
                    />
                    {erreurs.sousDomaine && (
                      <span className="text-xs text-error">{erreurs.sousDomaine}</span>
                    )}
                  </label>

                  <label className="flex flex-col gap-1 text-sm" htmlFor="pays">
                    Pays
                    <input
                      id="pays"
                      className="rounded-lg border border-outline-variant px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      value={pays}
                      onChange={(event) => setPays(event.target.value)}
                    />
                  </label>

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
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
