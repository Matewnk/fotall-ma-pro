import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson } from '../test-utils';
import { AuthProvider, useAuth } from './auth-context';

const SESSION = {
  accessToken: 'token-123',
  tenant: { id: 'tenant-1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
  user: { id: 'user-1', email: 'admin@pressing-test.dev', role: 'ADMIN' as const },
};

function ConsommateurTest() {
  const { session, login, logout } = useAuth();
  return (
    <div>
      <span>session: {session ? session.user.email : 'aucune'}</span>
      <button onClick={() => login('pressing-test', 'admin@pressing-test.dev', 'secret')}>
        connexion
      </button>
      <button onClick={logout}>deconnexion</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('login() appelle /auth/login, persiste la session et la rend disponible via useAuth', async () => {
    vi.mocked(fetch).mockResolvedValue(reponseJson(SESSION));

    render(
      <AuthProvider>
        <ConsommateurTest />
      </AuthProvider>,
    );

    expect(screen.getByText('session: aucune')).toBeDefined();
    await act(async () => {
      screen.getByText('connexion').click();
    });

    await waitFor(() => {
      expect(screen.getByText('session: admin@pressing-test.dev')).toBeDefined();
    });
    expect(JSON.parse(localStorage.getItem('fotall.session') ?? 'null')).toEqual(SESSION);
  });

  it('restaure la session depuis localStorage au montage', () => {
    localStorage.setItem('fotall.session', JSON.stringify(SESSION));

    render(
      <AuthProvider>
        <ConsommateurTest />
      </AuthProvider>,
    );

    expect(screen.getByText('session: admin@pressing-test.dev')).toBeDefined();
  });

  it('logout() efface la session et le localStorage', async () => {
    localStorage.setItem('fotall.session', JSON.stringify(SESSION));

    render(
      <AuthProvider>
        <ConsommateurTest />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByText('deconnexion').click();
    });

    expect(screen.getByText('session: aucune')).toBeDefined();
    expect(localStorage.getItem('fotall.session')).toBeNull();
  });
});
