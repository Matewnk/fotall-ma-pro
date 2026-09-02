import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

const ROUTE_CHANGEMENT_MOT_DE_PASSE = '/changer-mot-de-passe';

// Redirection côté client uniquement (confort UX) — jamais une garantie de
// sécurité : chaque route protégée appelle une API qui revalide le JWT et
// le rôle indépendamment (RolesGuard, RBAC serveur). Le blocage réel de
// mustChangePassword est côté serveur (JwtStrategy, 403 sur tout sauf
// JwtLenientAuthGuard) — cette redirection évite seulement d'atterrir sur
// un écran qui échouerait silencieusement.
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) {
    return <Navigate to="/connexion" replace />;
  }
  if (session.user.mustChangePassword && location.pathname !== ROUTE_CHANGEMENT_MOT_DE_PASSE) {
    return <Navigate to={ROUTE_CHANGEMENT_MOT_DE_PASSE} replace />;
  }
  return <>{children}</>;
}
