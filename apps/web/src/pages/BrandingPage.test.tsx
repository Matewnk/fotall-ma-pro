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

function installerFauxServeur(
  options: { reponseUpload?: { status: number; corps: unknown } } = {},
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/tenant/logo') && method === 'POST') {
        const reponse = options.reponseUpload ?? {
          status: 201,
          corps: { ...TENANT, logoUrl: 'http://localhost:3000/uploads/logos/t1.png?v=1' },
        };
        return Promise.resolve(reponseJson(reponse.corps, reponse.status));
      }
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

  it('téléverse un logo et affiche l’aperçu renvoyé par le serveur', async () => {
    installerFauxServeur();
    const { element } = renderAvecProviders(<BrandingPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByLabelText('Logo')).toBeDefined();
    });

    const fichier = new File(['contenu'], 'logo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Logo'), { target: { files: [fichier] } });

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/tenant/logo'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(screen.getByAltText('Logo du pressing')).toBeDefined();
    });
  });

  it('refuse localement un logo trop volumineux sans appeler le serveur', async () => {
    installerFauxServeur();
    const { element } = renderAvecProviders(<BrandingPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByLabelText('Logo')).toBeDefined();
    });

    const fichierTropGros = new File([new Uint8Array(3 * 1024 * 1024)], 'logo.png', {
      type: 'image/png',
    });
    fireEvent.change(screen.getByLabelText('Logo'), { target: { files: [fichierTropGros] } });

    await waitFor(() => {
      expect(screen.getByText('Fichier trop volumineux (2 Mo maximum).')).toBeDefined();
    });
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/tenant/logo'))).toBe(
      false,
    );
  });
});
