import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { SuperAdminInvoicesPage } from './SuperAdminInvoicesPage';

const FACTURES = [
  {
    id: 'fac-1',
    numero: 'FAC-2026-0001',
    tenantId: 'tenant-1',
    nomPressingSnap: 'Pressing Lumière',
    planSnap: 'PRO' as const,
    montant: 79000,
    devise: 'XOF',
    modePaiementSnap: 'CARTE' as const,
    periodeDebut: '2026-08-01T00:00:00Z',
    periodeFin: '2026-09-01T00:00:00Z',
    statut: 'PAYEE' as const,
    dateEmission: new Date().toISOString(),
    dateEcheance: '2026-09-01T00:00:00Z',
    emisePar: 'super-1',
    tenant: { nomPressing: 'Pressing Lumière' },
  },
  {
    id: 'fac-2',
    numero: 'FAC-2026-0002',
    tenantId: 'tenant-2',
    nomPressingSnap: 'Aqua Pressing',
    planSnap: 'STARTER' as const,
    montant: 15000,
    devise: 'XOF',
    modePaiementSnap: 'MOBILE_MONEY' as const,
    periodeDebut: '2026-08-01T00:00:00Z',
    periodeFin: '2026-09-01T00:00:00Z',
    statut: 'EN_RETARD' as const,
    dateEmission: '2026-08-01T00:00:00Z',
    dateEcheance: '2026-08-15T00:00:00Z',
    emisePar: 'super-1',
    tenant: { nomPressing: 'Aqua Pressing' },
  },
];

describe('SuperAdminInvoicesPage', () => {
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
      vi.fn(() => Promise.resolve(reponseJson(FACTURES))),
    );
  });

  it('affiche les factures de tous les tenants avec les KPI', async () => {
    const { element } = renderAvecProviders(<SuperAdminInvoicesPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('FAC-2026-0001')).toBeDefined();
      expect(screen.getByText('FAC-2026-0002')).toBeDefined();
      expect(screen.getByText('Factures du mois')).toBeDefined();
      expect(screen.getByText('Montant encaissé')).toBeDefined();
    });
  });

  it('filtre par recherche, plan et statut', async () => {
    const { element } = renderAvecProviders(<SuperAdminInvoicesPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('FAC-2026-0001')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Rechercher une facture'), {
      target: { value: 'aqua' },
    });
    await waitFor(() => {
      expect(screen.getByText('FAC-2026-0002')).toBeDefined();
      expect(screen.queryByText('FAC-2026-0001')).toBeNull();
    });

    fireEvent.change(screen.getByLabelText('Rechercher une facture'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'PAYEE' } });
    await waitFor(() => {
      expect(screen.getByText('FAC-2026-0001')).toBeDefined();
      expect(screen.queryByText('FAC-2026-0002')).toBeNull();
    });
  });
});
