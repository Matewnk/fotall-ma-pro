import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { SuperAdminLoginPage } from './SuperAdminLoginPage';

const SESSION_SUPER_ADMIN = {
  accessToken: 'token-super-123',
  user: { id: 'super-1', email: 'super@fotall.dev', role: 'SUPER_ADMIN' as const },
};

describe('SuperAdminLoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('se connecte via email + mot de passe (sans sous-domaine) et navigue vers /super-admin', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        expect(String(input)).toContain('/auth/super-admin/login');
        return Promise.resolve(reponseJson(SESSION_SUPER_ADMIN));
      }),
    );

    const { element } = renderAvecProviders(<SuperAdminLoginPage />);
    render(element);

    expect(screen.queryByLabelText('Sous-domaine')).toBeNull();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'super@fotall.dev' },
    });
    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByText('Se connecter'));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('fotall.session') ?? 'null')).toEqual(
        SESSION_SUPER_ADMIN,
      );
    });
  });

  it("affiche l'erreur serveur sur identifiants invalides", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(reponseJson({ statusCode: 401, message: 'Identifiants invalides.' }, 401)),
      ),
    );

    const { element } = renderAvecProviders(<SuperAdminLoginPage />);
    render(element);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'super@fotall.dev' },
    });
    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: 'faux' },
    });
    fireEvent.click(screen.getByText('Se connecter'));

    await waitFor(() => {
      expect(screen.getByText('Identifiants invalides.')).toBeDefined();
    });
  });
});
