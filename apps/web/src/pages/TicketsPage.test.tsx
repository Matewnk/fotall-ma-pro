import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderAvecProviders } from '../test-utils';
import { TicketsPage } from './TicketsPage';

const COMMANDE = {
  id: 'commande-1',
  numero: 1,
  clientId: 'client-1',
  statut: 'EN_ATTENTE' as const,
  sousTotal: '1000',
  total: '1000',
  modeLivraison: 'RETRAIT' as const,
  createdAt: '2026-08-19T10:00:00Z',
};
const COMMANDE_LIVRAISON = {
  id: 'commande-2',
  numero: 2,
  clientId: 'client-1',
  statut: 'PRET' as const,
  sousTotal: '2000',
  total: '2000',
  modeLivraison: 'LIVRAISON' as const,
  createdAt: '2026-08-19T10:00:00Z',
};

function installerFauxServeur(avecCommandeLivraison = false) {
  const commandes = avecCommandeLivraison ? [COMMANDE, COMMANDE_LIVRAISON] : [COMMANDE];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/ticket/bon-livraison/pdf')) {
        return Promise.resolve(
          new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { status: 200 }),
        );
      }
      if (url.includes('/ticket/pdf')) {
        return Promise.resolve(
          new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { status: 200 }),
        );
      }
      if (url.includes('/ticket/escpos')) {
        return Promise.resolve(new Response(new Blob([new Uint8Array([27, 64])]), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify(commandes), { status: 200 }));
    }),
  );
}

describe('TicketsPage', () => {
  beforeEach(() => {
    localStorage.setItem(
      'fotall.session',
      JSON.stringify({
        accessToken: 'token-123',
        tenant: { id: 't1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
        user: { id: 'u1', email: 'admin@pressing-test.dev', role: 'ADMIN' },
      }),
    );
    vi.stubGlobal('open', vi.fn());
    URL.createObjectURL = vi.fn(() => 'blob:fake-url');
    URL.revokeObjectURL = vi.fn();
    // jsdom ne supporte pas la navigation réelle déclenchée par
    // <a download>.click() — sans ce stub, chaque test de téléchargement
    // pollue stderr avec "Not implemented: navigation".
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('affiche la liste des commandes disponibles pour impression', async () => {
    installerFauxServeur();
    const { element } = renderAvecProviders(<TicketsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeDefined();
    });
  });

  it('ouvre le ticket PDF dans un nouvel onglet', async () => {
    installerFauxServeur();
    const { element } = renderAvecProviders(<TicketsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Ticket PDF'));

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith('blob:fake-url', '_blank');
    });
  });

  it('déclenche le téléchargement du ticket ESC/POS 58mm', async () => {
    installerFauxServeur();
    const { element } = renderAvecProviders(<TicketsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeDefined();
    });

    fireEvent.click(screen.getByText('ESC/POS 58mm'));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('ne propose "Bon de livraison" que pour une commande en mode LIVRAISON', async () => {
    installerFauxServeur(true);
    const { element } = renderAvecProviders(<TicketsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeDefined();
      expect(screen.getByText('#2')).toBeDefined();
    });

    expect(screen.getAllByText('Bon de livraison').length).toBe(1);
  });

  it('ouvre le bon de livraison dans un nouvel onglet', async () => {
    installerFauxServeur(true);
    const { element } = renderAvecProviders(<TicketsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('#2')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Bon de livraison'));

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith('blob:fake-url', '_blank');
    });
  });
});
