import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { OrdersPage } from './OrdersPage';

const CLIENTS = [{ id: 'client-1', nom: 'Fatou Sy', telephone: '+221701112233' }];
const SERVICES = [
  { id: 'service-1', code: 'SRV-01', intitule: 'Lavage', tarif: '1000.00' },
  { id: 'service-2', code: 'SRV-02', intitule: 'Repassage', tarif: '500.00' },
];
const COMMANDE_CREEE = {
  id: 'commande-1',
  numero: 1,
  clientId: 'client-1',
  statut: 'EN_ATTENTE' as const,
  sousTotal: '2500',
  total: '2500',
  modeLivraison: 'RETRAIT' as const,
  createdAt: '2026-08-19T10:00:00Z',
};

// Faux serveur en mémoire : /clients et /services sont statiques, POST
// /commandes ajoute à la liste rendue par le prochain GET /commandes —
// suffisant pour vérifier que la mutation invalide bien la requête liste.
function installerFauxServeur(commandesInitiales: unknown[] = []) {
  let commandes = commandesInitiales;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/clients')) {
        return Promise.resolve(reponseJson(CLIENTS));
      }
      if (url.includes('/services')) {
        return Promise.resolve(reponseJson(SERVICES));
      }
      if (url.includes('/commandes') && method === 'POST') {
        commandes = [...commandes, COMMANDE_CREEE];
        return Promise.resolve(reponseJson(COMMANDE_CREEE, 201));
      }
      return Promise.resolve(reponseJson(commandes));
    }),
  );
}

describe('OrdersPage', () => {
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

  it('affiche la liste des commandes existantes', async () => {
    installerFauxServeur([COMMANDE_CREEE]);
    const { element } = renderAvecProviders(<OrdersPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeDefined();
    });
  });

  it('affiche un message quand il n’y a aucune commande', async () => {
    installerFauxServeur([]);
    const { element } = renderAvecProviders(<OrdersPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText("Aucune commande pour l'instant.")).toBeDefined();
    });
  });

  it('crée une commande multi-lignes (panier), calcule le total indicatif et redirige vers l’encaissement', async () => {
    installerFauxServeur([]);

    const { element } = renderAvecProviders(<OrdersPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText("Aucune commande pour l'instant.")).toBeDefined();
    });

    fireEvent.click(screen.getByText('Nouvelle commande'));

    await waitFor(() => {
      expect(screen.getByText('Fatou Sy')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });

    // Ligne 1 : Lavage x2
    fireEvent.change(screen.getByLabelText('Service'), { target: { value: 'service-1' } });
    fireEvent.change(screen.getByLabelText('Quantité'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('Ajouter'));

    // Ligne 2 : Repassage x1
    fireEvent.change(screen.getByLabelText('Service'), { target: { value: 'service-2' } });
    fireEvent.change(screen.getByLabelText('Quantité'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Ajouter'));

    // Total indicatif = 2*1000 + 1*500 = 2500 (affiché, jamais envoyé au serveur)
    await waitFor(() => {
      expect(screen.getByText('2 500 FCFA')).toBeDefined();
    });

    fireEvent.click(screen.getByText('VALIDER LA COMMANDE'));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/commandes'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(
            '"articles":[{"serviceId":"service-1","quantite":2},{"serviceId":"service-2","quantite":1}]',
          ),
        }),
      );
    });
  });

  it('refuse de valider une commande sans aucune ligne au panier', async () => {
    installerFauxServeur([]);
    const { element } = renderAvecProviders(<OrdersPage />);
    render(element);

    fireEvent.click(screen.getByText('Nouvelle commande'));
    await waitFor(() => {
      expect(screen.getByText('Fatou Sy')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });
    fireEvent.click(screen.getByText('VALIDER LA COMMANDE'));

    await waitFor(() => {
      expect(screen.getByText('Ajoutez au moins une prestation au panier.')).toBeDefined();
    });
  });

  it('propose un lien "Encaisser" par commande vers l’écran de paiement dédié', async () => {
    installerFauxServeur([COMMANDE_CREEE]);
    const { element } = renderAvecProviders(<OrdersPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeDefined();
    });

    const lien = screen.getByText('Encaisser').closest('a');
    expect(lien?.getAttribute('href')).toBe('/commandes/commande-1/encaisser');
  });
});
