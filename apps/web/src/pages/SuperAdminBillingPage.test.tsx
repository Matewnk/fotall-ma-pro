import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { SuperAdminBillingPage } from './SuperAdminBillingPage';

const ABONNEMENTS = [
  {
    id: 'abo-1',
    tenantId: 'tenant-1',
    nomPressing: 'Pressing Lumière',
    plan: 'PRO' as const,
    modePaiement: 'CARTE' as const,
    montant: 35000,
    devise: 'XOF',
    statut: 'ACTIF' as const,
    dateProchaineFacturation: '2026-09-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'abo-2',
    tenantId: 'tenant-2',
    nomPressing: 'Aqua Pressing',
    plan: 'STARTER' as const,
    modePaiement: 'MOBILE_MONEY' as const,
    montant: 15000,
    devise: 'XOF',
    statut: 'EN_RETARD' as const,
    dateProchaineFacturation: '2026-09-05T00:00:00Z',
    createdAt: '2026-02-01T00:00:00Z',
  },
];

describe('SuperAdminBillingPage', () => {
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
      vi.fn(() => Promise.resolve(reponseJson(ABONNEMENTS))),
    );
  });

  it('affiche les abonnements de tous les tenants avec leur statut', async () => {
    const { element } = renderAvecProviders(<SuperAdminBillingPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Pressing Lumière')).toBeDefined();
      expect(screen.getByText('Aqua Pressing')).toBeDefined();
      const table = screen.getByRole('table');
      expect(within(table).getByText('En retard')).toBeDefined();
    });
  });

  it('filtre par recherche, plan et statut', async () => {
    const { element } = renderAvecProviders(<SuperAdminBillingPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Pressing Lumière')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Rechercher un abonnement'), {
      target: { value: 'aqua' },
    });
    await waitFor(() => {
      expect(screen.getByText('Aqua Pressing')).toBeDefined();
      expect(screen.queryByText('Pressing Lumière')).toBeNull();
    });

    fireEvent.change(screen.getByLabelText('Rechercher un abonnement'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'PRO' } });
    await waitFor(() => {
      expect(screen.getByText('Pressing Lumière')).toBeDefined();
      expect(screen.queryByText('Aqua Pressing')).toBeNull();
    });

    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'EN_RETARD' } });
    await waitFor(() => {
      expect(screen.getByText('Aqua Pressing')).toBeDefined();
      expect(screen.queryByText('Pressing Lumière')).toBeNull();
    });
  });
});
