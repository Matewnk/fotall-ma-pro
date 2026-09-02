import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '../lib/auth-context';
import { ProtectedRoute } from './ProtectedRoute';

const SESSION = {
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
            <Route path="/connexion" element={<span>Page de connexion</span>} />
            <Route
              path="/changer-mot-de-passe"
              element={<span>Changement de mot de passe obligatoire</span>}
            />
            <Route
              path="/prive"
              element={
                <ProtectedRoute>
                  <span>Contenu protégé</span>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redirige vers /connexion sans session', () => {
    monter(['/prive']);
    expect(screen.getByText('Page de connexion')).toBeDefined();
  });

  it('affiche le contenu avec une session valide', () => {
    localStorage.setItem('fotall.session', JSON.stringify(SESSION));
    monter(['/prive']);
    expect(screen.getByText('Contenu protégé')).toBeDefined();
  });

  it('redirige vers /changer-mot-de-passe quand mustChangePassword est actif', () => {
    localStorage.setItem(
      'fotall.session',
      JSON.stringify({ ...SESSION, user: { ...SESSION.user, mustChangePassword: true } }),
    );
    monter(['/prive']);
    expect(screen.getByText('Changement de mot de passe obligatoire')).toBeDefined();
  });
});
