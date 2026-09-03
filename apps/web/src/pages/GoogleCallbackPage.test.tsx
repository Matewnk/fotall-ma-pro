import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { GoogleCallbackPage } from './GoogleCallbackPage';

const SESSION = {
  accessToken: 'token-123',
  tenant: { id: 'tenant-1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
  user: { id: 'user-1', email: 'admin@test.dev', role: 'ADMIN' as const, mustChangePassword: false },
};

describe('GoogleCallbackPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('affiche le message d’erreur exact quand Google redirige avec ?erreur=google', async () => {
    const { element } = renderAvecProviders(
      <GoogleCallbackPage />,
      ['/inscription/google?erreur=google'],
    );
    render(element);

    await waitFor(() => {
      expect(
        screen.getByText('Impossible de créer votre compte avec Google. Veuillez réessayer.'),
      ).toBeDefined();
    });
  });

  it('échange le code contre une session existante et redirige (compte Google déjà connu)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        expect(String(input)).toContain('/auth/google/exchange');
        return Promise.resolve(reponseJson({ type: 'session', session: SESSION }));
      }),
    );

    const { element } = renderAvecProviders(
      <GoogleCallbackPage />,
      ['/inscription/google?code=abc123'],
    );
    render(element);

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('fotall.session') ?? 'null')).toEqual(SESSION);
    });
  });

  it('affiche le mini-formulaire de finalisation pour un nouveau compte Google', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(reponseJson({ type: 'ticket', ticket: 'ticket-signe' })),
      ),
    );

    const { element } = renderAvecProviders(
      <GoogleCallbackPage />,
      ['/inscription/google?code=abc123'],
    );
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Presque terminé')).toBeDefined();
    });
    expect(screen.getByLabelText('Nom du pressing')).toBeDefined();
    expect(screen.getByLabelText('Sous-domaine')).toBeDefined();
  });

  it('finalise l’inscription Google avec nomPressing/sousDomaine et enregistre la session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input).includes('/auth/google/exchange')) {
          return Promise.resolve(reponseJson({ type: 'ticket', ticket: 'ticket-signe' }));
        }
        expect(String(input)).toContain('/auth/register-google');
        return Promise.resolve(reponseJson(SESSION));
      }),
    );

    const { element } = renderAvecProviders(
      <GoogleCallbackPage />,
      ['/inscription/google?code=abc123'],
    );
    render(element);

    await waitFor(() => {
      expect(screen.getByLabelText('Nom du pressing')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Nom du pressing'), {
      target: { value: 'Pressing Google' },
    });
    fireEvent.change(screen.getByLabelText('Sous-domaine'), {
      target: { value: 'pressing-google' },
    });
    fireEvent.click(screen.getByText('Créer mon compte'));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('fotall.session') ?? 'null')).toEqual(SESSION);
    });
  });

  it('affiche le message d’erreur exact quand le code est invalide/expiré', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(reponseJson({ statusCode: 400, message: 'Code invalide' }, 400))),
    );

    const { element } = renderAvecProviders(
      <GoogleCallbackPage />,
      ['/inscription/google?code=code-expire'],
    );
    render(element);

    await waitFor(() => {
      expect(
        screen.getByText('Impossible de créer votre compte avec Google. Veuillez réessayer.'),
      ).toBeDefined();
    });
  });
});
