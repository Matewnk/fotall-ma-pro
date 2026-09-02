import type { Role } from '@fotall/shared-types';
import type { ReactNode } from 'react';
import { useState } from 'react';
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
  { to: '/support', label: 'Support', icon: 'support_agent' },
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
  const [menuOuvert, setMenuOuvert] = useState(false);

  function handleLogout() {
    logout();
    navigate('/connexion');
  }

  return (
    <div className="flex h-screen bg-surface-container-lowest overflow-hidden">
      {menuOuvert && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMenuOuvert(false)}
          aria-hidden="true"
        />
      )}
      <nav
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] shrink-0 flex-col border-r border-outline-variant bg-surface p-4 transition-transform duration-200 ease-out md:static md:z-auto md:w-64 md:max-w-none md:translate-x-0 ${
          menuOuvert ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 mt-2 flex items-center justify-between px-2">
          <div>
            <span className="block text-lg font-bold text-primary">
              {session?.tenant?.nomPressing}
            </span>
            <span className="block text-xs text-on-surface-variant">Console Admin</span>
          </div>
          <button
            type="button"
            onClick={() => setMenuOuvert(false)}
            className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-high md:hidden"
            aria-label="Fermer le menu"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex flex-grow flex-col gap-1 overflow-y-auto">
          {NAV_LINKS.filter(
            (link) => !link.roles || (session && link.roles.includes(session.user.role)),
          ).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              onClick={() => setMenuOuvert(false)}
              className={({ isActive }) => classesNav(isActive)}
            >
              <span className="material-symbols-outlined">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </div>
        <div className="mt-auto border-t border-outline-variant pt-4">
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
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-outline-variant bg-surface px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOuvert(true)}
            className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-high md:hidden"
            aria-label="Ouvrir le menu"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="truncate text-sm text-on-surface-variant">{session?.user.email}</span>
          <span className="hidden shrink-0 text-xs uppercase tracking-wide text-on-surface-variant sm:inline">
            {session?.user.role}
          </span>
        </header>
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
