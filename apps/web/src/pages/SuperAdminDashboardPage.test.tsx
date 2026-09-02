import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { SuperAdminDashboardPage } from './SuperAdminDashboardPage';

const STATS = {
  totalTenants: 12,
  repartitionLicences: { ESSAI: 5, ACTIVE: 4, EXPIREE: 2, SUSPENDUE: 1 },
  revenuMensuel: { devise: 'XOF', montant: 45200 },
  revenuMensuelAutresDevises: [],
  nouveauxAbonnementsMois: 3,
  tauxRetention: 92.5,
  revenuParPlan: [
    { plan: 'STARTER', montant: 4900 },
    { plan: 'PRO', montant: 24500 },
    { plan: 'BUSINESS', montant: 15800 },
  ],
  evolutionRevenusMensuels: Array.from({ length: 12 }, (_, i) => ({
    mois: `2026-${String(i + 1).padStart(2, '0')}`,
    montant: (i + 1) * 1000,
  })),
  inscriptionsRecentes: [
    {
      tenantId: 'tenant-1',
      nomPressing: 'Eco-Lavage Paris',
      sousDomaine: 'eco-lavage',
      plan: 'PRO',
      createdAt: '2026-08-20T10:42:00.000Z',
      statutLicence: 'ACTIVE',
    },
  ],
  alertes: {
    paiementsEnRetard: [
      {
        tenantId: 'tenant-2',
        nomPressing: 'Laverie Centrale',
        montant: 15000,
        devise: 'XOF',
        depuis: '2026-08-15T00:00:00.000Z',
      },
    ],
    licencesExpirantBientot: [
      {
        tenantId: 'tenant-3',
        nomPressing: 'Clean & Go',
        statut: 'ESSAI',
        dateEcheance: '2026-08-25T00:00:00.000Z',
        joursRestants: 3,
      },
    ],
  },
};

describe('SuperAdminDashboardPage', () => {
  beforeEach(() => {
    localStorage.setItem(
      'fotall.session',
      JSON.stringify({
        accessToken: 'token-super-123',
        user: { id: 'super-1', email: 'super@fotall.dev', role: 'SUPER_ADMIN' },
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(reponseJson(STATS))),
    );
  });

  it('affiche le total de tenants et la répartition des licences', async () => {
    const { element } = renderAvecProviders(<SuperAdminDashboardPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('12')).toBeDefined();
      expect(screen.getByText('5')).toBeDefined();
      expect(screen.getByText('En essai')).toBeDefined();
    });
  });

  it('affiche le revenu mensuel, le revenu par plan, les inscriptions récentes et les alertes système', async () => {
    const { element } = renderAvecProviders(<SuperAdminDashboardPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('45 200 XOF')).toBeDefined();
      expect(screen.getByText('92.5%')).toBeDefined();
      expect(screen.getByText('Eco-Lavage Paris')).toBeDefined();
      expect(screen.getByText(/Paiement en retard/)).toBeDefined();
      expect(screen.getByText(/Laverie Centrale/)).toBeDefined();
      expect(screen.getByText(/Licence bientôt expirée/)).toBeDefined();
      expect(screen.getByText(/Clean & Go/)).toBeDefined();
    });
  });
});
