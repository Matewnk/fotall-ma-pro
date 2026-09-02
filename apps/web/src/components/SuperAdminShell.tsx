import type { ReactNode } from 'react';
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

// Ossature distincte d'AppShell (jamais partagée — Constitution II,
// rôles jamais fusionnés) : pas d'identité de tenant à afficher (une
// session SUPER_ADMIN n'en a pas), navigation propre à la console SaaS.
const NAV_LINKS = [
  { to: '/super-admin', label: 'Vue globale', icon: 'dashboard' },
  { to: '/super-admin/tenants', label: 'Tenants', icon: 'store' },
  { to: '/super-admin/plans', label: 'Plans', icon: 'sell' },
  { to: '/super-admin/utilisateurs', label: 'Utilisateurs', icon: 'group' },
  { to: '/super-admin/support-tickets', label: 'Support', icon: 'support_agent' },
  { to: '/super-admin/audit', label: 'Audit & Sécurité', icon: 'fact_check' },
  { to: '/super-admin/facturation', label: 'Facturation', icon: 'receipt_long' },
  { to: '/super-admin/factures', label: 'Factures', icon: 'request_quote' },
];

function classesNav(actif: boolean): string {
  const base = 'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors';
  return actif
    ? `${base} bg-secondary-container text-on-secondary-container font-medium`
    : `${base} text-on-surface-variant hover:bg-surface-container-high`;
}

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOuvert, setMenuOuvert] = useState(false);

  function handleLogout() {
    logout();
    navigate('/super-admin/connexion');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-container-lowest">
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
            <span className="block text-lg font-bold text-primary">Fotall-Ma Pro</span>
            <span className="block text-xs text-on-surface-variant">Console Super-Admin</span>
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
          {NAV_LINKS.map((link) => (
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
