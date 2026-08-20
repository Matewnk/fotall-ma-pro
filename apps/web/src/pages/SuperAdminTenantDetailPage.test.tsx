import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { SuperAdminTenantDetailPage } from './SuperAdminTenantDetailPage';

const TENANT = {
  id: 'tenant-1',
  nomPressing: 'Pressing Lumière',
  sousDomaine: 'pressing-lumiere',
  plan: 'PRO' as const,
  langue: 'fr',
  devise: 'XOF',
  fuseauHoraire: 'Africa/Dakar',
  createdAt: '2026-01-01T00:00:00Z',
  licence: {
    statut: 'ESSAI' as const,
    dateDebutEssai: '2026-01-01T00:00:00Z',
    dateFinEssai: '2026-01-15T00:00:00Z',
  },
};

function monter(reponseAbonnement: { status: number; corps: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/facturation/')) {
        return Promise.resolve(reponseJson(reponseAbonnement.corps, reponseAbonnement.status));
      }
      if (url.includes('/licence/activer') && method === 'POST') {
        return Promise.resolve(reponseJson({ ...TENANT.licence, statut: 'ACTIVE' }, 201));
      }
      return Promise.resolve(reponseJson(TENANT));
    }),
  );

  localStorage.setItem(
    'fotall.session',
    JSON.stringify({
      accessToken: 'token-super-123',
      user: { id: 'super-1', email: 'super@fotall.dev', role: 'SUPER_ADMIN' },
    }),
  );

  const { element } = renderAvecProviders(
    <Routes>
      <Route path="/super-admin/tenants/:id" element={<SuperAdminTenantDetailPage />} />
    </Routes>,
    ['/super-admin/tenants/tenant-1'],
  );
  render(element);
}

describe('SuperAdminTenantDetailPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('affiche les informations du tenant et son statut de licence', async () => {
    monter({ status: 404, corps: { statusCode: 404, message: 'Aucun abonnement.' } });

    await waitFor(() => {
      expect(screen.getByText('Pressing Lumière')).toBeDefined();
      expect(screen.getByText('ESSAI')).toBeDefined();
    });
  });

  it('propose la création d’un abonnement quand aucun n’existe (404)', async () => {
    monter({ status: 404, corps: { statusCode: 404, message: 'Aucun abonnement.' } });

    await waitFor(() => {
      expect(screen.getByText('Aucun abonnement pour ce tenant.')).toBeDefined();
    });
  });

  it('affiche l’abonnement existant quand il y en a un', async () => {
    monter({
      status: 200,
      corps: {
        id: 'abo-1',
        tenantId: 'tenant-1',
        plan: 'PRO',
        modePaiement: 'CARTE',
        montant: '15000.00',
        devise: 'XOF',
        statut: 'ACTIF',
        dateProchaineFacturation: '2026-02-01T00:00:00Z',
        journal: [],
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/Abonnement PRO/)).toBeDefined();
    });
  });

  it('déclenche l’activation de la licence', async () => {
    monter({ status: 404, corps: { statusCode: 404, message: 'Aucun abonnement.' } });

    await waitFor(() => {
      expect(screen.getByText('Pressing Lumière')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Activer'));

    await waitFor(() => {
      const appelActiver = vi
        .mocked(fetch)
        .mock.calls.some(([input]) => String(input).includes('/licence/activer'));
      expect(appelActiver).toBe(true);
    });
  });
});
