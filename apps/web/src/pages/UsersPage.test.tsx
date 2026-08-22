import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { UsersPage } from './UsersPage';

const UTILISATEUR_EXISTANT = {
  id: 'user-1',
  email: 'caissier@pressing-test.dev',
  role: 'CAISSIER' as const,
  actif: true,
  createdAt: '2026-08-20T10:00:00Z',
};
const UTILISATEUR_CREE = {
  id: 'user-2',
  email: 'technicien@pressing-test.dev',
  role: 'TECHNICIEN' as const,
  actif: true,
  createdAt: '2026-08-20T11:00:00Z',
};

function installerFauxServeur(utilisateursInitiaux: unknown[] = []) {
  let utilisateurs = utilisateursInitiaux;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/users') && method === 'POST') {
        utilisateurs = [...utilisateurs, UTILISATEUR_CREE];
        return Promise.resolve(reponseJson(UTILISATEUR_CREE, 201));
      }
      if (url.match(/\/users\/user-1$/) && method === 'PATCH') {
        const misAJour = { ...UTILISATEUR_EXISTANT, actif: false };
        utilisateurs = utilisateurs.map((u) =>
          (u as { id: string }).id === 'user-1' ? misAJour : u,
        );
        return Promise.resolve(reponseJson(misAJour));
      }
      if (url.match(/\/users\/user-1\/mot-de-passe$/) && method === 'PATCH') {
        return Promise.resolve(reponseJson({ ok: true }));
      }
      return Promise.resolve(reponseJson(utilisateurs));
    }),
  );
}

describe('UsersPage', () => {
  beforeEach(() => {
    localStorage.setItem(
      'fotall.session',
      JSON.stringify({
        accessToken: 'token-123',
        tenant: { id: 't1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
        user: { id: 'admin-1', email: 'admin@pressing-test.dev', role: 'ADMIN' },
      }),
    );
  });

  it('affiche la liste des utilisateurs existants', async () => {
    installerFauxServeur([UTILISATEUR_EXISTANT]);
    const { element } = renderAvecProviders(<UsersPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('caissier@pressing-test.dev')).toBeDefined();
    });
  });

  it('crée un utilisateur via le formulaire et rafraîchit la liste', async () => {
    installerFauxServeur([]);
    const { element } = renderAvecProviders(<UsersPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText("Aucun utilisateur pour l'instant.")).toBeDefined();
    });

    fireEvent.click(screen.getByText('Nouvel utilisateur'));
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'technicien@pressing-test.dev' },
    });
    fireEvent.change(screen.getByLabelText('Mot de passe provisoire'), {
      target: { value: 'super-secret-1' },
    });
    fireEvent.click(screen.getByText("Créer l'utilisateur"));

    await waitFor(() => {
      expect(screen.getByText('technicien@pressing-test.dev')).toBeDefined();
    });
  });

  it('désactive un utilisateur', async () => {
    installerFauxServeur([UTILISATEUR_EXISTANT]);
    const { element } = renderAvecProviders(<UsersPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('caissier@pressing-test.dev')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Désactiver'));

    await waitFor(() => {
      expect(screen.getByText('Inactif')).toBeDefined();
    });
  });

  it('réinitialise le mot de passe d’un utilisateur après confirmation via le prompt', async () => {
    installerFauxServeur([UTILISATEUR_EXISTANT]);
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('nouveau-secret-1');
    const { element } = renderAvecProviders(<UsersPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('caissier@pressing-test.dev')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Réinitialiser mot de passe'));

    expect(promptSpy).toHaveBeenCalledWith(expect.stringContaining('caissier@pressing-test.dev'));
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/users/user-1/mot-de-passe'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('n’envoie rien si le prompt de réinitialisation est annulé', async () => {
    installerFauxServeur([UTILISATEUR_EXISTANT]);
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    const { element } = renderAvecProviders(<UsersPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('caissier@pressing-test.dev')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Réinitialiser mot de passe'));

    const appelReinitialisation = vi
      .mocked(fetch)
      .mock.calls.some(([input]) => String(input).includes('/mot-de-passe'));
    expect(appelReinitialisation).toBe(false);
  });
});
