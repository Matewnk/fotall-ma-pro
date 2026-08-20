import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

// Ossature distincte d'AppShell (jamais partagée — Constitution II,
// rôles jamais fusionnés) : pas d'identité de tenant à afficher (une
// session SUPER_ADMIN n'en a pas), navigation propre à la console SaaS.
const NAV_LINKS = [{ to: '/super-admin', label: 'Vue globale', icon: 'dashboard' }];

function classesNav(actif: boolean): string {
  const base = 'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors';
  return actif
    ? `${base} bg-secondary-container text-on-secondary-container font-medium`
    : `${base} text-on-surface-variant hover:bg-surface-container-high`;
}

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/super-admin/connexion');
  }

  return (
    <div className="flex h-screen bg-surface-container-lowest">
      <nav className="w-64 shrink-0 border-r border-outline-variant bg-surface p-4 flex flex-col">
        <div className="mb-8 px-2 mt-2">
          <span className="block text-lg font-bold text-primary">Fotall-Ma Pro</span>
          <span className="block text-xs text-on-surface-variant">Console Super-Admin</span>
        </div>
        <div className="flex flex-col gap-1 flex-grow">
          {NAV_LINKS.map((link) => (
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
