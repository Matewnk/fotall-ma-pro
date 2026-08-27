import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderAvecProviders } from '../test-utils';
import { ReportsPage } from './ReportsPage';

const RAPPORT_CAISSE_QUOTIDIENNE = {
  colonnes: ['Type', 'Montant'],
  lignes: [['ENCAISSEMENT', 1000]],
  resume: { soldeOuverture: '29600', soldeCloture: '43700', totalENCAISSEMENT: '14700' },
};
const RAPPORT_ACTIVITE = {
  colonnes: ['Date', 'Commandes'],
  lignes: [['2026-08-20', 5]],
};

function installerFauxServeur() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/rapports/activite')) {
        return Promise.resolve(new Response(JSON.stringify(RAPPORT_ACTIVITE), { status: 200 }));
      }
      if (url.includes('/rapports/caisse-quotidienne')) {
        return Promise.resolve(
          new Response(JSON.stringify(RAPPORT_CAISSE_QUOTIDIENNE), { status: 200 }),
        );
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    }),
  );
}

describe('ReportsPage', () => {
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

  it('affiche le rapport par défaut (caisse quotidienne) avec son résumé', async () => {
    installerFauxServeur();
    const { element } = renderAvecProviders(<ReportsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('ENCAISSEMENT')).toBeDefined();
    });
  });

  it('affiche des libellés lisibles pour le résumé (jamais la clé brute en majuscules)', async () => {
    installerFauxServeur();
    const { element } = renderAvecProviders(<ReportsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText("Solde d'ouverture")).toBeDefined();
      expect(screen.getByText('29600')).toBeDefined();
      expect(screen.getByText('Solde de clôture')).toBeDefined();
      expect(screen.getByText('Total Encaissement')).toBeDefined();
    });
    expect(screen.queryByText('soldeOuverture')).toBeNull();
    expect(screen.queryByText('SOLDEOUVERTURE')).toBeNull();
  });

  it('change de rapport et affiche les colonnes filtrables par date', async () => {
    installerFauxServeur();
    const { element } = renderAvecProviders(<ReportsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('ENCAISSEMENT')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Rapport'), { target: { value: 'activite' } });

    await waitFor(() => {
      expect(screen.getByText('2026-08-20')).toBeDefined();
    });
    expect(screen.getByLabelText('Du')).toBeDefined();
  });
});
