import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { ChangePasswordPage } from './ChangePasswordPage';

const SESSION = {
  accessToken: 'token-temp-123',
  tenant: { id: 'tenant-1', nomPressing: 'Pressing Lumière', sousDomaine: 'lumiere' },
  user: {
    id: 'user-1',
    email: 'admin@pressing-lumiere.dev',
    role: 'ADMIN',
    mustChangePassword: true,
  },
};

function monter() {
  localStorage.setItem('fotall.session', JSON.stringify(SESSION));
  const { element } = renderAvecProviders(<ChangePasswordPage />);
  render(element);
}

function remplirEtSoumettre(actuel: string, nouveau: string, confirmation: string) {
  fireEvent.change(screen.getByLabelText('Mot de passe temporaire'), {
    target: { value: actuel },
  });
  fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), {
    target: { value: nouveau },
  });
  fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), {
    target: { value: confirmation },
  });
  fireEvent.click(screen.getByText('Changer mon mot de passe'));
}

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('refuse la soumission si la confirmation ne correspond pas', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    monter();

    remplirEtSoumettre('temp-1', 'nouveau-secret-1', 'autre-chose');

    await waitFor(() => {
      expect(screen.getByText('La confirmation ne correspond pas.')).toBeDefined();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('affiche l’erreur renvoyée par l’API (mot de passe actuel incorrect)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          reponseJson({ statusCode: 401, message: 'Mot de passe actuel incorrect.' }, 401),
        ),
      ),
    );
    monter();

    remplirEtSoumettre('faux', 'nouveau-secret-1', 'nouveau-secret-1');

    await waitFor(() => {
      expect(screen.getByText('Mot de passe actuel incorrect.')).toBeDefined();
    });
  });

  it('met à jour la session avec le nouveau token après un changement réussi', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          reponseJson({
            accessToken: 'token-final-456',
            tenant: SESSION.tenant,
            user: { ...SESSION.user, mustChangePassword: false },
          }),
        ),
      ),
    );
    monter();

    remplirEtSoumettre('temp-1', 'nouveau-secret-1', 'nouveau-secret-1');

    await waitFor(() => {
      const session = JSON.parse(localStorage.getItem('fotall.session') ?? 'null');
      expect(session.accessToken).toBe('token-final-456');
      expect(session.user.mustChangePassword).toBe(false);
    });
  });

  it('affiche un état de chargement pendant la soumission', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(reponseJson({ accessToken: 't', user: SESSION.user })), 50);
          }),
      ),
    );
    monter();

    remplirEtSoumettre('temp-1', 'nouveau-secret-1', 'nouveau-secret-1');

    await waitFor(() => {
      expect(screen.getByText('Changement…')).toBeDefined();
    });
  });
});
