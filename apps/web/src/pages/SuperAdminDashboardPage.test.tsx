import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { SuperAdminDashboardPage } from './SuperAdminDashboardPage';

const STATS = {
  totalTenants: 12,
  repartitionLicences: { ESSAI: 5, ACTIVE: 4, EXPIREE: 2, SUSPENDUE: 1 },
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
});
