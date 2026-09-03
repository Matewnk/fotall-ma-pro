import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { SuperAdminBusinessRequestsPage } from './SuperAdminBusinessRequestsPage';

const DEMANDES = [
  {
    id: 'demande-1',
    nomComplet: 'Jean Dupont',
    entreprise: 'Pressing Lumière',
    email: 'jean.dupont@example.dev',
    telephone: '+221 77 000 00 00',
    typeActivite: 'PRESSING_BLANCHISSERIE' as const,
    typeDemande: 'DEVIS' as const,
    message: 'Nous avons 5 sites à équiper.',
    statut: 'NOUVEAU' as const,
    createdAt: '2026-08-20T10:00:00Z',
    updatedAt: '2026-08-20T10:00:00Z',
  },
  {
    id: 'demande-2',
    nomComplet: 'Awa Ndiaye',
    entreprise: 'Aqua Lavage',
    email: 'awa@example.dev',
    telephone: '+221 78 111 11 11',
    typeActivite: 'LAVAGE_AUTO' as const,
    typeDemande: 'DEMONSTRATION' as const,
    message: 'Nous voulons une démonstration.',
    statut: 'TRAITE' as const,
    createdAt: '2026-08-19T10:00:00Z',
    updatedAt: '2026-08-19T10:00:00Z',
  },
];

describe('SuperAdminBusinessRequestsPage', () => {
  beforeEach(() => {
    localStorage.setItem(
      'fotall.session',
      JSON.stringify({
        accessToken: 'token-super-123',
        user: { id: 'super-1', email: 'super@fotall.dev', role: 'SUPER_ADMIN' },
      }),
    );
  });

  it('affiche les demandes de tous les tenants', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(reponseJson(DEMANDES))),
    );
    const { element } = renderAvecProviders(<SuperAdminBusinessRequestsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Jean Dupont')).toBeDefined();
      expect(screen.getByText('Pressing Lumière')).toBeDefined();
      expect(screen.getByText('Awa Ndiaye')).toBeDefined();
    });
  });

  it('affiche un état vide quand il n’y a aucune demande', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(reponseJson([]))),
    );
    const { element } = renderAvecProviders(<SuperAdminBusinessRequestsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Aucune demande.')).toBeDefined();
    });
  });

  it('filtre par statut (appel serveur avec le paramètre statut)', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('statut=TRAITE')) {
        return Promise.resolve(reponseJson([DEMANDES[1]]));
      }
      return Promise.resolve(reponseJson(DEMANDES));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { element } = renderAvecProviders(<SuperAdminBusinessRequestsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Jean Dupont')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Traitées'));

    await waitFor(() => {
      expect(screen.getByText('Awa Ndiaye')).toBeDefined();
      expect(screen.queryByText('Jean Dupont')).toBeNull();
    });
  });
});
