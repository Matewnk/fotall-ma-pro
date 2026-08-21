import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { AuditPage } from './AuditPage';

const ENTREE = {
  id: 'audit-1',
  action: 'TENANT_PLAN_MODIFIE',
  entityType: 'Tenant',
  entityId: 'tenant-1',
  actorId: 'super-1',
  createdAt: '2026-08-21T10:00:00Z',
};

function installerFauxServeur() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('action=')) {
        return Promise.resolve(reponseJson([ENTREE]));
      }
      return Promise.resolve(reponseJson([ENTREE]));
    }),
  );
}

describe('AuditPage', () => {
  beforeEach(() => {
    localStorage.setItem(
      'fotall.session',
      JSON.stringify({
        accessToken: 'token-123',
        tenant: { id: 't1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
        user: { id: 'admin-1', email: 'admin@pressing-test.dev', role: 'ADMIN' },
      }),
    );
  });

  it('affiche les entrées du journal d’audit', async () => {
    installerFauxServeur();
    const { element } = renderAvecProviders(<AuditPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('TENANT_PLAN_MODIFIE')).toBeDefined();
    });
  });

  it('filtre par action', async () => {
    installerFauxServeur();
    const { element } = renderAvecProviders(<AuditPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('TENANT_PLAN_MODIFIE')).toBeDefined();
    });

    fireEvent.change(screen.getByPlaceholderText(/Filtrer par action/), {
      target: { value: 'TENANT_PLAN_MODIFIE' },
    });

    await waitFor(() => {
      const appelFiltre = vi
        .mocked(fetch)
        .mock.calls.some(([input]) => String(input).includes('action=TENANT_PLAN_MODIFIE'));
      expect(appelFiltre).toBe(true);
    });
  });
});
