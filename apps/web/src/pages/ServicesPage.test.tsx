import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { ServicesPage } from './ServicesPage';

const SERVICE_EXISTANT = {
  id: 'service-1',
  code: 'SRV-01',
  intitule: 'Lavage',
  categorie: 'Vêtements',
  tarif: '1000.00',
  actif: true,
};
const SERVICE_CREE = {
  id: 'service-2',
  code: 'SRV-02',
  intitule: 'Repassage',
  categorie: 'Vêtements',
  tarif: '500.00',
  actif: true,
};

function installerFauxServeur(servicesInitiaux: unknown[] = []) {
  let services = servicesInitiaux;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/services') && method === 'POST') {
        services = [...services, SERVICE_CREE];
        return Promise.resolve(reponseJson(SERVICE_CREE, 201));
      }
      if (url.includes('/services') && method === 'DELETE') {
        services = services.filter((s) => (s as { id: string }).id !== 'service-1');
        return Promise.resolve(reponseJson(undefined));
      }
      return Promise.resolve(reponseJson(services));
    }),
  );
}

describe('ServicesPage', () => {
  beforeEach(() => {
    localStorage.setItem(
      'fotall.session',
      JSON.stringify({
        accessToken: 'token-123',
        tenant: { id: 't1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
        user: { id: 'u1', email: 'admin@pressing-test.dev', role: 'ADMIN' },
      }),
    );
  });

  it('affiche la liste des services existants', async () => {
    installerFauxServeur([SERVICE_EXISTANT]);
    const { element } = renderAvecProviders(<ServicesPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Lavage')).toBeDefined();
    });
  });

  it('affiche un message quand il n’y a aucun service', async () => {
    installerFauxServeur([]);
    const { element } = renderAvecProviders(<ServicesPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText("Aucun service pour l'instant.")).toBeDefined();
    });
  });

  it('crée un service via le formulaire et rafraîchit la liste', async () => {
    installerFauxServeur([]);
    const { element } = renderAvecProviders(<ServicesPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText("Aucun service pour l'instant.")).toBeDefined();
    });

    fireEvent.click(screen.getByText('Ajouter un service'));
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'SRV-02' } });
    fireEvent.change(screen.getByLabelText('Intitulé'), { target: { value: 'Repassage' } });
    fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: 'Vêtements' } });
    fireEvent.change(screen.getByLabelText('Tarif (FCFA)'), { target: { value: '500' } });
    fireEvent.click(screen.getByText('Créer le service'));

    await waitFor(() => {
      expect(screen.getByText('Repassage')).toBeDefined();
    });
  });

  it('supprime un service après confirmation', async () => {
    installerFauxServeur([SERVICE_EXISTANT]);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    const { element } = renderAvecProviders(<ServicesPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Lavage')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Supprimer'));

    await waitFor(() => {
      expect(screen.getByText("Aucun service pour l'instant.")).toBeDefined();
    });
  });
});
