import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { SuperAdminSupportTicketDetailPage } from './SuperAdminSupportTicketDetailPage';

const TICKET = {
  id: 'ticket-1',
  tenantId: 'tenant-1',
  auteurId: 'user-1',
  sujet: 'Imprimante hors service',
  description: "L'imprimante ESC/POS ne répond plus.",
  statut: 'OUVERT' as const,
  priorite: 'HAUTE' as const,
  createdAt: '2026-08-20T10:00:00Z',
  updatedAt: '2026-08-20T10:00:00Z',
  tenant: { nomPressing: 'Pressing Lumière' },
  messages: [] as unknown[],
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
        path="/super-admin/support-tickets/:id"
        element={<SuperAdminSupportTicketDetailPage />}
      />
    </Routes>,
    ['/super-admin/support-tickets/ticket-1'],
  );
  render(element);
}

describe('SuperAdminSupportTicketDetailPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('affiche le ticket, le tenant et propose de changer le statut', async () => {
    monter(vi.fn(() => Promise.resolve(reponseJson(TICKET))));

    await waitFor(() => {
      expect(screen.getByText('Imprimante hors service')).toBeDefined();
      expect(screen.getByText(/Pressing Lumière/)).toBeDefined();
      expect(screen.getByText('Marquer en cours')).toBeDefined();
      expect(screen.getByText('Marquer résolu')).toBeDefined();
    });
  });

  it('change le statut du ticket', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'PATCH') {
        return Promise.resolve(reponseJson({ ...TICKET, statut: 'EN_COURS' }));
      }
      return Promise.resolve(reponseJson(TICKET));
    });
    monter(fetchMock);

    await waitFor(() => {
      expect(screen.getByText('Marquer en cours')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Marquer en cours'));

    await waitFor(() => {
      const appelPatch = fetchMock.mock.calls.some(
        ([reqInput, reqInit]) =>
          String(reqInput).includes('/support-tickets/ticket-1/statut') &&
          (reqInit as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(appelPatch).toBe(true);
    });
  });
});
