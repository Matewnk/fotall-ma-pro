import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { CashPage } from './CashPage';

const OPERATION_EXISTANTE = {
  id: 'op-1',
  type: 'ENCAISSEMENT' as const,
  montant: '1000.00',
  modePaiement: 'ESPECES' as const,
  createdAt: '2026-08-20T14:23:00Z',
};
const OPERATION_CREEE = {
  id: 'op-2',
  type: 'DEPENSE' as const,
  montant: '85.00',
  createdAt: '2026-08-20T15:00:00Z',
};

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
});
