import type { Role } from '@fotall/shared-types';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

// `roles` absent = visible à tous les rôles authentifiés. Premier lien
// effectivement restreint (/utilisateurs, réservé ADMIN côté API) : le
// masquage n'est jamais une autorisation, seulement pour éviter un lien
// menant systématiquement à un 403.
const NAV_LINKS: { to: string; label: string; icon: string; roles?: Role[] }[] = [
  { to: '/', label: 'Tableau de bord', icon: 'dashboard' },
  { to: '/commandes', label: 'Commandes', icon: 'receipt_long' },
  { to: '/clients', label: 'Clients', icon: 'group' },
  { to: '/services', label: 'Tarifs & services', icon: 'sell' },
  {
    to: '/stocks',
    label: 'Stocks & consommables',
    icon: 'inventory_2',
    roles: ['ADMIN', 'CAISSIER', 'TECHNICIEN'],
  },
  { to: '/caisse', label: 'Caisse', icon: 'point_of_sale' },
  { to: '/tickets', label: 'Tickets', icon: 'print' },
  { to: '/rapports', label: 'Rapports', icon: 'analytics' },
  { to: '/utilisateurs', label: 'Utilisateurs', icon: 'manage_accounts', roles: ['ADMIN'] },
  { to: '/branding', label: 'Branding', icon: 'palette', roles: ['ADMIN'] },
  { to: '/audit', label: 'Audit', icon: 'fact_check', roles: ['ADMIN'] },
];

function classesNav(actif: boolean): string {
  const base = 'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors';
  return actif
    ? `${base} bg-secondary-container text-on-secondary-container font-medium`
    : `${base} text-on-surface-variant hover:bg-surface-container-high`;
}

// Ossature partagée par tout écran authentifié : navigation latérale
// (filtrée par rôle — le masquage n'est jamais une autorisation, chaque
// route sert son propre RBAC serveur) + en-tête avec identité du tenant.
export function AppShell({ children }: { children: ReactNode }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/connexion');
  }

  return (
    <div className="flex h-screen bg-surface-container-lowest">
      <nav className="w-64 shrink-0 border-r border-outline-variant bg-surface p-4 flex flex-col">
        <div className="mb-8 px-2 mt-2">
          <span className="block text-lg font-bold text-primary">
            {session?.tenant?.nomPressing}
          </span>
          <span className="block text-xs text-on-surface-variant">Console Admin</span>
        </div>
        <div className="flex flex-col gap-1 flex-grow">
          {NAV_LINKS.filter(
            (link) => !link.roles || (session && link.roles.includes(session.user.role)),
          ).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              className={({ isActive }) => classesNav(isActive)}
            >
              <span className="material-symbols-outlined">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </div>
        <div className="mt-auto pt-4 border-t border-outline-variant">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-xl text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined">logout</span>
            Déconnexion
          </button>
        </div>
      </nav>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between h-16 px-6 border-b border-outline-variant bg-surface shrink-0">
          <span className="text-sm text-on-surface-variant">{session?.user.email}</span>
          <span className="text-xs uppercase tracking-wide text-on-surface-variant">
            {session?.user.role}
          </span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
