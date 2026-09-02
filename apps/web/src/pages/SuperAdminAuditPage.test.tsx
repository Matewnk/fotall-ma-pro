import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { SuperAdminAuditPage } from './SuperAdminAuditPage';

const EVENEMENTS = [
  {
    id: 'evt-1',
    type: 'LICENCE' as const,
    tenantId: 'tenant-1',
    nomPressing: 'Pressing Lumière',
    action: 'ACTIVATION',
    effectuePar: 'super-1',
    motif: 'Paiement reçu',
    createdAt: '2026-08-20T10:00:00Z',
  },
  {
    id: 'evt-2',
    type: 'SUPPORT' as const,
    tenantId: 'tenant-2',
    nomPressing: 'Aqua Pressing',
    action: 'SESSION_SUPPORT_TERMINEE',
    effectuePar: 'super-1',
    motif: 'Diagnostic incident client',
    createdAt: '2026-08-19T09:00:00Z',
  },
];

describe('SuperAdminAuditPage', () => {
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
      vi.fn(() => Promise.resolve(reponseJson(EVENEMENTS))),
    );
  });

  it('affiche les évènements de licence et de support de tous les tenants', async () => {
    const { element } = renderAvecProviders(<SuperAdminAuditPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Pressing Lumière')).toBeDefined();
      expect(screen.getByText('Aqua Pressing')).toBeDefined();
      expect(screen.getByText('Activation')).toBeDefined();
      expect(screen.getByText('Session support terminée')).toBeDefined();
    });
  });

  it('filtre par recherche et par type', async () => {
    const { element } = renderAvecProviders(<SuperAdminAuditPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Pressing Lumière')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Rechercher un évènement'), {
      target: { value: 'diagnostic' },
    });
    await waitFor(() => {
      expect(screen.getByText('Aqua Pressing')).toBeDefined();
      expect(screen.queryByText('Pressing Lumière')).toBeNull();
    });

    fireEvent.change(screen.getByLabelText('Rechercher un évènement'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'LICENCE' } });
    await waitFor(() => {
      expect(screen.getByText('Pressing Lumière')).toBeDefined();
      expect(screen.queryByText('Aqua Pressing')).toBeNull();
    });
  });
});
