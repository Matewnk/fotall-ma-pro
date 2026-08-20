import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { BrandingPage } from './BrandingPage';

const TENANT = {
  id: 't1',
  nomPressing: 'Pressing Test',
  sousDomaine: 'pressing-test',
  adresse: '1 rue Test',
  telephone: '+221700000000',
  langue: 'fr',
  devise: 'XOF',
  fuseauHoraire: 'Africa/Dakar',
};

function installerFauxServeur() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'PATCH') {
        const corps = JSON.parse(init?.body as string) as Record<string, unknown>;
        return Promise.resolve(reponseJson({ ...TENANT, ...corps }));
      }
      return Promise.resolve(reponseJson(TENANT));
    }),
  );
}

describe('BrandingPage', () => {
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

  it('précharge le formulaire avec les informations actuelles du tenant', async () => {
    installerFauxServeur();
    const { element } = renderAvecProviders(<BrandingPage />);
    render(element);

    await waitFor(() => {
      expect((screen.getByLabelText("Nom de l'établissement") as HTMLInputElement).value).toBe(
        'Pressing Test',
      );
      expect((screen.getByLabelText('Adresse') as HTMLInputElement).value).toBe('1 rue Test');
    });
  });

  it('enregistre les modifications et affiche une confirmation', async () => {
    installerFauxServeur();
    const { element } = renderAvecProviders(<BrandingPage />);
    render(element);

    await waitFor(() => {
      expect((screen.getByLabelText("Nom de l'établissement") as HTMLInputElement).value).toBe(
        'Pressing Test',
      );
    });

    fireEvent.change(screen.getByLabelText("Nom de l'établissement"), {
      target: { value: 'Pressing Renommé' },
    });
    fireEvent.click(screen.getByText('Enregistrer'));

    await waitFor(() => {
      expect(screen.getByText('Enregistré.')).toBeDefined();
    });
  });
});
