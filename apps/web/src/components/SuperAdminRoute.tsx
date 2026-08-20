import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

// Même principe que ProtectedRoute (confort UX, jamais une garantie de
// sécurité — RolesGuard(SUPER_ADMIN) revalide côté serveur) : redirige
// vers la connexion super-admin si absente, ou si la session appartient
// à un tenant (role !== SUPER_ADMIN) plutôt que d'afficher un écran qui
// échouera systématiquement en 403.
export function SuperAdminRoute({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/super-admin/connexion" replace />;
  }
  return <>{children}</>;
}
