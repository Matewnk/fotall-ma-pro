import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '../lib/auth-context';
import { SuperAdminRoute } from './SuperAdminRoute';

const SESSION_SUPER_ADMIN = {
  accessToken: 'token-super-123',
  user: { id: 'super-1', email: 'super@fotall.dev', role: 'SUPER_ADMIN' as const },
};

const SESSION_TENANT = {
  accessToken: 'token-123',
  tenant: { id: 'tenant-1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
  user: { id: 'user-1', email: 'admin@pressing-test.dev', role: 'ADMIN' as const },
};

function monter(initialEntries: string[]) {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/super-admin/connexion" element={<span>Connexion super-admin</span>} />
            <Route
              path="/super-admin"
              element={
                <SuperAdminRoute>
                  <span>Console super-admin</span>
                </SuperAdminRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('SuperAdminRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redirige vers /super-admin/connexion sans session', () => {
    monter(['/super-admin']);
    expect(screen.getByText('Connexion super-admin')).toBeDefined();
  });

  it('redirige une session tenant (ADMIN) vers la connexion super-admin', () => {
    localStorage.setItem('fotall.session', JSON.stringify(SESSION_TENANT));
    monter(['/super-admin']);
    expect(screen.getByText('Connexion super-admin')).toBeDefined();
  });

  it('affiche le contenu avec une session SUPER_ADMIN valide', () => {
    localStorage.setItem('fotall.session', JSON.stringify(SESSION_SUPER_ADMIN));
    monter(['/super-admin']);
    expect(screen.getByText('Console super-admin')).toBeDefined();
  });
});
