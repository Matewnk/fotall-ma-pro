import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { SuperAdminTenantsPage } from './SuperAdminTenantsPage';

const TENANTS = [
  {
    id: 'tenant-1',
    nomPressing: 'Pressing Lumière',
    sousDomaine: 'pressing-lumiere',
    plan: 'PRO' as const,
    createdAt: '2026-01-01T00:00:00Z',
    licence: { statut: 'ACTIVE' as const, dateFinEssai: '2026-01-15T00:00:00Z' },
  },
];

describe('SuperAdminTenantsPage', () => {
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
      vi.fn(() => Promise.resolve(reponseJson(TENANTS))),
    );
  });

  it('affiche la liste des tenants avec leur statut de licence', async () => {
    const { element } = renderAvecProviders(<SuperAdminTenantsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Pressing Lumière')).toBeDefined();
      expect(screen.getByText('Active')).toBeDefined();
    });
  });
});
