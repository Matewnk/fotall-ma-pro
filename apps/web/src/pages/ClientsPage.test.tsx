import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { ClientsPage } from './ClientsPage';

const CLIENT_EXISTANT = {
  id: 'client-1',
  nom: 'Fatou Sy',
  telephone: '+221701112233',
  statut: 'ACTIF' as const,
};
const CLIENT_CREE = {
  id: 'client-2',
  nom: 'Awa Ndiaye',
  telephone: '+221709998877',
  statut: 'ACTIF' as const,
};

function installerFauxServeur(clientsInitiaux: unknown[] = []) {
  let clients = clientsInitiaux;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/clients') && method === 'POST') {
        clients = [...clients, CLIENT_CREE];
        return Promise.resolve(reponseJson(CLIENT_CREE, 201));
      }
      if (url.includes('/clients') && method === 'DELETE') {
        clients = clients.filter((c) => (c as { id: string }).id !== 'client-1');
        return Promise.resolve(reponseJson(undefined));
      }
      return Promise.resolve(reponseJson(clients));
    }),
  );
}

describe('ClientsPage', () => {
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

  it('affiche la liste des clients existants', async () => {
    installerFauxServeur([CLIENT_EXISTANT]);
    const { element } = renderAvecProviders(<ClientsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Fatou Sy')).toBeDefined();
    });
  });

  it('affiche un message quand il n’y a aucun client', async () => {
    installerFauxServeur([]);
    const { element } = renderAvecProviders(<ClientsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText("Aucun client pour l'instant.")).toBeDefined();
    });
  });

  it('crée un client via le formulaire et rafraîchit la liste', async () => {
    installerFauxServeur([]);
    const { element } = renderAvecProviders(<ClientsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText("Aucun client pour l'instant.")).toBeDefined();
    });

    fireEvent.click(screen.getByText('Nouveau client'));
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Awa Ndiaye' } });
    fireEvent.change(screen.getByLabelText('Téléphone'), {
      target: { value: '+221709998877' },
    });
    fireEvent.click(screen.getByText('Créer le client'));

    await waitFor(() => {
      expect(screen.getByText('Awa Ndiaye')).toBeDefined();
    });
  });

  it('supprime un client après confirmation', async () => {
    installerFauxServeur([CLIENT_EXISTANT]);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    const { element } = renderAvecProviders(<ClientsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Fatou Sy')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Supprimer'));

    await waitFor(() => {
      expect(screen.getByText("Aucun client pour l'instant.")).toBeDefined();
    });
  });
});
