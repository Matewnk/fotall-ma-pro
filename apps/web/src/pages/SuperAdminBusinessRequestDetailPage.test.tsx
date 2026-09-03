import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { SuperAdminBusinessRequestDetailPage } from './SuperAdminBusinessRequestDetailPage';

const DEMANDE_NOUVELLE = {
  id: 'demande-1',
  nomComplet: 'Jean Dupont',
  entreprise: 'Pressing Lumière',
  email: 'jean.dupont@example.dev',
  telephone: '+221 77 000 00 00',
  typeActivite: 'PRESSING_BLANCHISSERIE' as const,
  nombrePointsDeService: 5,
  typeDemande: 'DEVIS' as const,
  message: 'Nous avons 5 sites à équiper de votre solution.',
  statut: 'NOUVEAU' as const,
  createdAt: '2026-08-20T10:00:00Z',
  updatedAt: '2026-08-20T10:00:00Z',
};

function monter(fetchMock: ReturnType<typeof vi.fn>) {
  localStorage.setItem(
    'fotall.session',
    JSON.stringify({
      accessToken: 'token-super-123',
      user: { id: 'super-1', email: 'super@fotall.dev', role: 'SUPER_ADMIN' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);

  const { element } = renderAvecProviders(
    <Routes>
      <Route
        path="/super-admin/business-requests/:id"
        element={<SuperAdminBusinessRequestDetailPage />}
      />
    </Routes>,
    ['/super-admin/business-requests/demande-1'],
  );
  render(element);
}

describe('SuperAdminBusinessRequestDetailPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('affiche tous les détails de la demande', async () => {
    monter(vi.fn(() => Promise.resolve(reponseJson(DEMANDE_NOUVELLE))));

    await waitFor(() => {
      expect(screen.getByText('Jean Dupont')).toBeDefined();
      expect(screen.getByText('Pressing Lumière')).toBeDefined();
      expect(screen.getByText('jean.dupont@example.dev')).toBeDefined();
      expect(screen.getByText('+221 77 000 00 00')).toBeDefined();
      expect(screen.getByText('Pressing / Blanchisserie')).toBeDefined();
      expect(screen.getByText('5')).toBeDefined();
      expect(screen.getByText('Demander un devis')).toBeDefined();
      expect(screen.getByText(DEMANDE_NOUVELLE.message)).toBeDefined();
    });
  });

  it('depuis NOUVEAU : "Passer en cours" et "Rejeter" actifs, "Marquer comme traitée" désactivé', async () => {
    monter(vi.fn(() => Promise.resolve(reponseJson(DEMANDE_NOUVELLE))));

    await waitFor(() => {
      expect(screen.getByText('Passer en cours')).toBeDefined();
    });
    expect(
      (screen.getByText('Passer en cours').closest('button') as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(
      (screen.getByText('Marquer comme traitée').closest('button') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByText('Rejeter').closest('button') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('depuis EN_COURS : "Marquer comme traitée" et "Rejeter" actifs, "Passer en cours" désactivé', async () => {
    monter(vi.fn(() => Promise.resolve(reponseJson({ ...DEMANDE_NOUVELLE, statut: 'EN_COURS' }))));

    await waitFor(() => {
      expect(screen.getByText('Marquer comme traitée')).toBeDefined();
    });
    expect(
      (screen.getByText('Passer en cours').closest('button') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByText('Marquer comme traitée').closest('button') as HTMLButtonElement).disabled,
    ).toBe(false);
    expect((screen.getByText('Rejeter').closest('button') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('depuis TRAITE (terminal) : toutes les actions sont désactivées', async () => {
    monter(vi.fn(() => Promise.resolve(reponseJson({ ...DEMANDE_NOUVELLE, statut: 'TRAITE' }))));

    await waitFor(() => {
      expect(screen.getByText('Passer en cours')).toBeDefined();
    });
    expect(
      (screen.getByText('Passer en cours').closest('button') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByText('Marquer comme traitée').closest('button') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByText('Rejeter').closest('button') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('change le statut de la demande', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'PATCH') {
        return Promise.resolve(reponseJson({ ...DEMANDE_NOUVELLE, statut: 'EN_COURS' }));
      }
      return Promise.resolve(reponseJson(DEMANDE_NOUVELLE));
    });
    monter(fetchMock);

    await waitFor(() => {
      expect(screen.getByText('Passer en cours')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Passer en cours'));

    await waitFor(() => {
      const appelPatch = fetchMock.mock.calls.some(
        ([reqInput, reqInit]) =>
          String(reqInput).includes('/demandes-business/demande-1/statut') &&
          (reqInit as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(appelPatch).toBe(true);
    });
  });

  it('affiche l’erreur si le changement de statut échoue', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'PATCH') {
        return Promise.resolve(
          reponseJson({ statusCode: 400, message: 'Transition impossible.' }, 400),
        );
      }
      return Promise.resolve(reponseJson(DEMANDE_NOUVELLE));
    });
    monter(fetchMock);

    await waitFor(() => {
      expect(screen.getByText('Passer en cours')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Passer en cours'));

    await waitFor(() => {
      expect(screen.getByText('Transition impossible.')).toBeDefined();
    });
  });

  it('affiche "Demande introuvable." si la demande n’existe pas', async () => {
    monter(vi.fn(() => Promise.resolve(reponseJson({ statusCode: 404 }, 404))));

    await waitFor(() => {
      expect(screen.getByText('Demande introuvable.')).toBeDefined();
    });
  });
});
