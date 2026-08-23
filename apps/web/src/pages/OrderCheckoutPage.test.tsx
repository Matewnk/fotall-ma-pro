import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { OrderCheckoutPage } from './OrderCheckoutPage';

const CLIENT = { id: 'client-1', nom: 'Fatou Sy', telephone: '+221701112233' };
const SERVICES = [{ id: 'service-1', code: 'SRV-01', intitule: 'Lavage', tarif: '5000.00' }];
const COMMANDE = {
  id: 'commande-1',
  numero: 42,
  clientId: 'client-1',
  statut: 'EN_ATTENTE' as const,
  sousTotal: '10000',
  total: '10000',
  modeLivraison: 'RETRAIT' as const,
  articles: [
    { id: 'art-1', serviceId: 'service-1', quantite: 2, tarifUnitaire: '5000', sousTotal: '10000' },
  ],
  createdAt: '2026-08-19T10:00:00Z',
};

function installerFauxServeur(
  options: {
    operationsExistantes?: unknown[];
    encaissementReponse?: { status: number; corps: unknown };
  } = {},
) {
  const operationsExistantes = options.operationsExistantes ?? [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/commandes/commande-1')) {
        return Promise.resolve(reponseJson(COMMANDE));
      }
      if (url.includes('/clients/client-1')) {
        return Promise.resolve(reponseJson(CLIENT));
      }
      if (url.includes('/services')) {
        return Promise.resolve(reponseJson(SERVICES));
      }
      if (url.includes('/caisse/operations') && method === 'POST') {
        const reponse = options.encaissementReponse ?? {
          status: 201,
          corps: { id: 'op-1', type: 'ENCAISSEMENT', montant: '10000', monnaie: '5000' },
        };
        return Promise.resolve(reponseJson(reponse.corps, reponse.status));
      }
      if (url.includes('/caisse/operations')) {
        return Promise.resolve(reponseJson(operationsExistantes));
      }
      return Promise.resolve(reponseJson({}));
    }),
  );
}

function monter() {
  return renderAvecProviders(
    <Routes>
      <Route path="/commandes/:id/encaisser" element={<OrderCheckoutPage />} />
    </Routes>,
    ['/commandes/commande-1/encaisser'],
  );
}

describe('OrderCheckoutPage', () => {
  beforeEach(() => {
    localStorage.setItem(
      'fotall.session',
      JSON.stringify({
        accessToken: 'token-123',
        tenant: { id: 't1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
        user: { id: 'u1', email: 'caissier@pressing-test.dev', role: 'CAISSIER' },
      }),
    );
  });

  it('affiche le total en lecture seule dérivé de la commande (jamais saisi par le caissier)', async () => {
    installerFauxServeur();
    const { element } = monter();
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Fatou Sy')).toBeDefined();
    });

    expect(screen.getAllByText(/10000|10 000/).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/^Total/)).toBeNull();
  });

  it('calcule la monnaie à partir du montant reçu saisi', async () => {
    installerFauxServeur();
    const { element } = monter();
    render(element);

    await waitFor(() => {
      expect(screen.getByLabelText('Montant reçu (FCFA)')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Montant reçu (FCFA)'), { target: { value: '15000' } });

    await waitFor(() => {
      expect(screen.getByText('5 000 FCFA')).toBeDefined();
    });
  });

  it('encaisse la commande : envoie montantRecu (jamais un montant), le serveur dérive le total', async () => {
    installerFauxServeur();
    const { element } = monter();
    render(element);

    await waitFor(() => {
      expect(screen.getByLabelText('Montant reçu (FCFA)')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Montant reçu (FCFA)'), { target: { value: '15000' } });
    fireEvent.click(screen.getByText('ENCAISSER LA COMMANDE'));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/caisse/operations'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"commandeId":"commande-1"'),
        }),
      );
      const appelPost = vi
        .mocked(fetch)
        .mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
      expect(appelPost?.[1]?.body).not.toContain('"montant"');
      expect(appelPost?.[1]?.body).toContain('"montantRecu":15000');
    });
  });

  it('refuse localement un montant reçu insuffisant sans appeler le serveur', async () => {
    installerFauxServeur();
    const { element } = monter();
    render(element);

    await waitFor(() => {
      expect(screen.getByLabelText('Montant reçu (FCFA)')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Montant reçu (FCFA)'), { target: { value: '3000' } });
    fireEvent.click(screen.getByText('ENCAISSER LA COMMANDE'));

    await waitFor(() => {
      expect(screen.getByText('Montant reçu insuffisant : 10000 FCFA dus.')).toBeDefined();
    });
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST'),
    ).toBe(false);
  });

  it('affiche l’état "déjà encaissée" et masque le formulaire de paiement', async () => {
    installerFauxServeur({
      operationsExistantes: [
        { id: 'op-0', type: 'ENCAISSEMENT', montant: '10000', commandeId: 'commande-1' },
      ],
    });
    const { element } = monter();
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Cette commande est déjà encaissée.')).toBeDefined();
    });
    expect(screen.queryByLabelText('Montant reçu (FCFA)')).toBeNull();
  });

  it('affiche l’erreur serveur en cas de double encaissement concurrent (409)', async () => {
    installerFauxServeur({
      encaissementReponse: {
        status: 409,
        corps: { message: 'Cette commande est déjà encaissée.' },
      },
    });
    const { element } = monter();
    render(element);

    await waitFor(() => {
      expect(screen.getByLabelText('Montant reçu (FCFA)')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Montant reçu (FCFA)'), { target: { value: '10000' } });
    fireEvent.click(screen.getByText('ENCAISSER LA COMMANDE'));

    await waitFor(() => {
      expect(screen.getByText('Cette commande est déjà encaissée.')).toBeDefined();
    });
  });
});
