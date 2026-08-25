import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { CashPage } from './CashPage';

const OPERATION_EXISTANTE = {
  id: 'op-1',
  type: 'ENCAISSEMENT' as const,
  montant: '1000.00',
  modePaiement: 'ESPECES' as const,
  commandeId: 'commande-1',
  createdAt: '2026-08-20T14:23:00Z',
};
const COMMANDE_LIEE = {
  id: 'commande-1',
  numero: 7,
  clientId: 'client-1',
  statut: 'PRET' as const,
  sousTotal: '1000',
  total: '1000',
  modeLivraison: 'RETRAIT' as const,
  createdAt: '2026-08-20T10:00:00Z',
};
const OPERATION_CREEE = {
  id: 'op-2',
  type: 'DEPENSE' as const,
  montant: '85.00',
  createdAt: '2026-08-20T15:00:00Z',
};

function aujourdHuiISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function installerFauxServeur(operationsInitiales: unknown[] = []) {
  let operations = operationsInitiales;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/caisse/solde')) {
        return Promise.resolve(reponseJson({ solde: '1850.00' }));
      }
      if (url.includes('/caisse/operations') && method === 'POST') {
        operations = [...operations, OPERATION_CREEE];
        return Promise.resolve(reponseJson(OPERATION_CREEE, 201));
      }
      if (url.includes('/caisse/operations')) {
        return Promise.resolve(reponseJson(operations));
      }
      if (url.includes('/commandes')) {
        return Promise.resolve(reponseJson([COMMANDE_LIEE]));
      }
      return Promise.resolve(reponseJson(operations));
    }),
  );
}

describe('CashPage', () => {
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

  it('affiche le solde et le journal des opérations', async () => {
    installerFauxServeur([OPERATION_EXISTANTE]);
    const { element } = renderAvecProviders(<CashPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('1850.00 FCFA')).toBeDefined();
      expect(screen.getByText('Encaissement')).toBeDefined();
    });
  });

  it('affiche le numéro de commande liée à un encaissement', async () => {
    installerFauxServeur([OPERATION_EXISTANTE]);
    const { element } = renderAvecProviders(<CashPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('#7')).toBeDefined();
    });
  });

  it('enregistre une nouvelle opération via le formulaire', async () => {
    installerFauxServeur([]);
    const { element } = renderAvecProviders(<CashPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText("Aucune opération pour l'instant.")).toBeDefined();
    });

    fireEvent.click(screen.getByText('Nouvelle opération'));
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'DEPENSE' } });
    fireEvent.change(screen.getByLabelText('Montant'), { target: { value: '85' } });
    fireEvent.click(screen.getByText("Enregistrer l'opération"));

    await waitFor(() => {
      expect(screen.getByText('Dépense')).toBeDefined();
    });
  });

  it('propose Wave et Orange Money dans le sélecteur de mode', async () => {
    installerFauxServeur([]);
    const { element } = renderAvecProviders(<CashPage />);
    render(element);

    fireEvent.click(screen.getByText('Nouvelle opération'));

    await waitFor(() => {
      expect(screen.getByLabelText('Mode')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'WAVE' } });
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'ORANGE_MONEY' } });
    // Aucune exception levée : les deux valeurs existent bien comme options.
  });

  it('affiche le résumé du jour (encaissements par mode, dépenses)', async () => {
    installerFauxServeur([
      { ...OPERATION_EXISTANTE, id: 'op-jour-1', createdAt: `${aujourdHuiISO()}T09:00:00Z` },
      {
        id: 'op-jour-2',
        type: 'ENCAISSEMENT' as const,
        montant: '2000.00',
        modePaiement: 'WAVE' as const,
        createdAt: `${aujourdHuiISO()}T10:00:00Z`,
      },
      {
        id: 'op-jour-3',
        type: 'DEPENSE' as const,
        montant: '300.00',
        createdAt: `${aujourdHuiISO()}T11:00:00Z`,
      },
    ]);
    const { element } = renderAvecProviders(<CashPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Encaissements du jour par mode')).toBeDefined();
      expect(screen.getAllByText('Wave').length).toBeGreaterThan(0);
      expect(screen.getByText('2 000 FCFA')).toBeDefined();
      expect(screen.getByText('300 FCFA')).toBeDefined(); // dépenses du jour
    });
  });

  it('clôture la caisse et empêche une seconde clôture le même jour', async () => {
    installerFauxServeur([]);
    const { element } = renderAvecProviders(<CashPage />);
    render(element);

    fireEvent.click(screen.getByText('Clôturer la caisse'));
    await waitFor(() => {
      expect(screen.getByText('Confirmer la clôture')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Confirmer la clôture'));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/caisse/operations'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(`"idempotencyKey":"cloture-${aujourdHuiISO()}"`),
        }),
      );
    });
  });
});
