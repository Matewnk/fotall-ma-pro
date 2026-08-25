import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { OrdersPage } from './OrdersPage';

const CLIENTS = [{ id: 'client-1', nom: 'Fatou Sy', telephone: '+221701112233' }];
const NOUVEAU_CLIENT = { id: 'client-2', nom: 'Awa Diop', telephone: '+221709998877' };
const SERVICES = [
  {
    id: 'service-1',
    code: 'SRV-01',
    intitule: 'Lavage',
    categorie: 'Vêtements',
    tarif: '1000.00',
    icone: 'checkroom',
    actif: true,
  },
  {
    id: 'service-2',
    code: 'SRV-02',
    intitule: 'Repassage',
    categorie: 'Repassage',
    tarif: '500.00',
    icone: 'iron',
    actif: true,
  },
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
  let clients: unknown[] = CLIENTS;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/clients') && method === 'POST') {
        clients = [...clients, NOUVEAU_CLIENT];
        return Promise.resolve(reponseJson(NOUVEAU_CLIENT, 201));
      }
      if (url.includes('/clients')) {
        return Promise.resolve(reponseJson(clients));
      }
      if (url.includes('/services')) {
        return Promise.resolve(reponseJson(SERVICES));
      }
      if (url.includes('/commandes') && method === 'POST') {
        commandes = [...commandes, COMMANDE_CREEE];
        return Promise.resolve(reponseJson(COMMANDE_CREEE, 201));
      }
      if (url.match(/\/commandes\/[^/]+\/statut$/) && method === 'PATCH') {
        const { statut } = JSON.parse(String(init?.body)) as { statut: string };
        commandes = commandes.map((c) =>
          (c as { id: string }).id === (COMMANDE_CREEE as { id: string }).id
            ? { ...(c as object), statut }
            : c,
        );
        return Promise.resolve(reponseJson({ ...COMMANDE_CREEE, statut }));
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

  it('crée une commande multi-lignes via les catégories, calcule le total indicatif et redirige vers l’encaissement', async () => {
    installerFauxServeur([]);

    const { element } = renderAvecProviders(<OrdersPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText("Aucune commande pour l'instant.")).toBeDefined();
    });

    fireEvent.click(screen.getByText('Nouvelle commande'));

    await waitFor(() => {
      expect(screen.getByLabelText('Client')).toBeDefined();
    });
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });

    // Catégorie "Vêtements" → service "Lavage" (ajouté au panier)
    fireEvent.click(screen.getByText('Vêtements'));
    await waitFor(() => {
      expect(screen.getByText('Lavage')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Lavage'));
    fireEvent.click(screen.getByText('Catégories'));

    // Catégorie "Repassage" → service "Repassage" (ajouté au panier)
    fireEvent.click(screen.getByText('Repassage'));
    await waitFor(() => {
      expect(screen.getAllByText('Repassage').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByRole('button', { name: /Repassage.*500.00 FCFA/ }));

    // Augmente la quantité de Lavage via le stepper du ticket (1 → 2)
    fireEvent.click(screen.getByLabelText('Augmenter Lavage'));

    // Total indicatif = 2*1000 + 1*500 = 2500
    await waitFor(() => {
      expect(screen.getByText('2 500')).toBeDefined();
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

  it('refuse de valider une commande sans client sélectionné', async () => {
    installerFauxServeur([]);
    const { element } = renderAvecProviders(<OrdersPage />);
    render(element);

    fireEvent.click(screen.getByText('Nouvelle commande'));
    await waitFor(() => {
      expect(screen.getByText('Vêtements')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Vêtements'));
    await waitFor(() => {
      expect(screen.getByText('Lavage')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Lavage'));

    fireEvent.click(screen.getByText('VALIDER LA COMMANDE'));

    await waitFor(() => {
      expect(screen.getByText('Choisissez un client.')).toBeDefined();
    });
  });

  it('crée un nouveau client directement depuis l’écran de commande et le sélectionne automatiquement', async () => {
    installerFauxServeur([]);
    const { element } = renderAvecProviders(<OrdersPage />);
    render(element);

    fireEvent.click(screen.getByText('Nouvelle commande'));
    await waitFor(() => {
      expect(screen.getByLabelText('Client')).toBeDefined();
    });

    fireEvent.click(screen.getByTitle('Nouveau client'));
    await waitFor(() => {
      expect(screen.getByText('Créer le client')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Awa Diop' } });
    fireEvent.change(screen.getByLabelText('Téléphone'), { target: { value: '+221709998877' } });
    fireEvent.click(screen.getByText('Créer le client'));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/clients'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ nom: 'Awa Diop', telephone: '+221709998877' }),
        }),
      );
      // Le nouveau client devient le client actif : la carte remplace le
      // sélecteur, plus besoin de le choisir dans la liste.
      expect(screen.getByText('Awa Diop')).toBeDefined();
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

  it('fait progresser le statut d’une commande (jamais figé sur "En attente")', async () => {
    installerFauxServeur([COMMANDE_CREEE]);
    const { element } = renderAvecProviders(<OrdersPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('En attente')).toBeDefined();
    });

    fireEvent.click(screen.getByTitle('Passer à EN_COURS'));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/commandes/commande-1/statut'),
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ statut: 'EN_COURS' }) }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText('En cours')).toBeDefined();
    });
  });
});
