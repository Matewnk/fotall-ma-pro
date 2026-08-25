import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from './api-client';
import type { Session } from './types';

const STORAGE_KEY = 'fotall.session';

type AuthContextValue = {
  session: Session | null;
  // true tant que la lecture initiale d'AsyncStorage n'est pas résolue —
  // contrairement à localStorage (web, synchrone), AsyncStorage.getItem
  // est async : impossible de connaître la session au premier rendu.
  chargement: boolean;
  login: (sousDomaine: string, email: string, motDePasse: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Session (token + tenant + user) persistée dans AsyncStorage pour
// survivre à un redémarrage de l'app — jamais de logique d'autorisation
// ici, uniquement de l'affichage conditionnel (le frontend n'est jamais
// une autorité de sécurité, chaque appel API revalide indépendamment JWT
// + rôle côté serveur). Même contrat que apps/web/src/lib/auth-context.tsx.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((brut) => {
        if (brut) {
          try {
            setSession(JSON.parse(brut) as Session);
          } catch {
            // Session corrompue : ignorée, comportement identique à une
            // absence de session (web, lireSessionStockee).
          }
        }
      })
      .finally(() => setChargement(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      chargement,
      async login(sousDomaine, email, motDePasse) {
        const resultat = await apiFetch<Session>('/auth/login', {
          method: 'POST',
          body: { sousDomaine, email, motDePasse },
        });
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(resultat));
        setSession(resultat);
      },
      async logout() {
        await AsyncStorage.removeItem(STORAGE_KEY);
        setSession(null);
      },
    }),
    [session, chargement],
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
