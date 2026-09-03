import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from './api-client';
import type { Session } from './types';

const STORAGE_KEY = 'fotall.session';

type AuthContextValue = {
  session: Session | null;
  login: (sousDomaine: string, email: string, motDePasse: string) => Promise<void>;
  register: (data: {
    nomPressing: string;
    sousDomaine: string;
    email: string;
    motDePasse: string;
    prenom?: string;
    nom?: string;
    pays?: string;
  }) => Promise<void>;
  // Finalise une inscription démarrée via Google (ticket signé obtenu par
  // GET /auth/google/callback puis POST /auth/google/exchange) — email/
  // prenom/nom viennent du ticket côté serveur, jamais du formulaire.
  registerGoogle: (data: {
    ticket: string;
    nomPressing: string;
    sousDomaine: string;
    pays?: string;
  }) => Promise<void>;
  loginSuperAdmin: (email: string, motDePasse: string) => Promise<void>;
  // Remplace la session en place (accessToken + user à jour) sans passer
  // par un login — utilisé après le changement de mot de passe self-service
  // (PATCH /auth/mot-de-passe), qui révoque l'ancien token en même temps
  // qu'il lève mustChangePassword.
  updateSession: (session: Session) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function lireSessionStockee(): Session | null {
  const brut = localStorage.getItem(STORAGE_KEY);
  if (!brut) {
    return null;
  }
  try {
    return JSON.parse(brut) as Session;
  } catch {
    return null;
  }
}

// Contexte unique pour la session : token + tenant + user en mémoire,
// persistés dans localStorage pour survivre à un rechargement de page.
// Jamais de logique d'autorisation ici — le frontend n'est jamais une
// autorité de sécurité (CLAUDE.md), seulement un affichage conditionnel du
// menu (voir AppShell) que le serveur revalide systématiquement.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => lireSessionStockee());

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      async login(sousDomaine, email, motDePasse) {
        const resultat = await apiFetch<Session>('/auth/login', {
          method: 'POST',
          body: { sousDomaine, email, motDePasse },
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(resultat));
        setSession(resultat);
      },
      async register(data) {
        const resultat = await apiFetch<Session>('/auth/register', {
          method: 'POST',
          body: data,
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(resultat));
        setSession(resultat);
      },
      async registerGoogle(data) {
        const resultat = await apiFetch<Session>('/auth/register-google', {
          method: 'POST',
          body: data,
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(resultat));
        setSession(resultat);
      },
      async loginSuperAdmin(email, motDePasse) {
        const resultat = await apiFetch<Session>('/auth/super-admin/login', {
          method: 'POST',
          body: { email, motDePasse },
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(resultat));
        setSession(resultat);
      },
      updateSession(resultat) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(resultat));
        setSession(resultat);
      },
      logout() {
        localStorage.removeItem(STORAGE_KEY);
        setSession(null);
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé sous AuthProvider.');
  }
  return context;
}
