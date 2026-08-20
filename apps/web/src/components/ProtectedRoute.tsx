import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

// Redirection côté client uniquement (confort UX) — jamais une garantie de
// sécurité : chaque route protégée appelle une API qui revalide le JWT et
// le rôle indépendamment (RolesGuard, RBAC serveur).
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  if (!session) {
    return <Navigate to="/connexion" replace />;
  }
  return <>{children}</>;
}
