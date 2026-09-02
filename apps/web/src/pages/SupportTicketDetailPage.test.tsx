import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { SupportTicketDetailPage } from './SupportTicketDetailPage';

const TICKET = {
  id: 'ticket-1',
  tenantId: 'tenant-1',
  auteurId: 'user-1',
  sujet: 'Imprimante hors service',
  description: "L'imprimante ESC/POS ne répond plus.",
  statut: 'EN_COURS' as const,
  priorite: 'HAUTE' as const,
  createdAt: '2026-08-20T10:00:00Z',
  updatedAt: '2026-08-20T10:00:00Z',
  messages: [
    {
      id: 'msg-1',
      ticketId: 'ticket-1',
      auteurId: 'super-1',
      auteurType: 'SUPER_ADMIN' as const,
      corps: 'Nous regardons ça, merci de patienter.',
      createdAt: '2026-08-20T11:00:00Z',
    },
  ],
};

function monter(fetchMock: ReturnType<typeof vi.fn>) {
  localStorage.setItem(
    'fotall.session',
    JSON.stringify({
      accessToken: 'token-admin-123',
      tenant: { id: 'tenant-1', nomPressing: 'Pressing Lumière', sousDomaine: 'lumiere' },
      user: { id: 'user-1', email: 'admin@pressing-lumiere.dev', role: 'ADMIN' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);

  const { element } = renderAvecProviders(
    <Routes>
      <Route path="/support/:id" element={<SupportTicketDetailPage />} />
    </Routes>,
    ['/support/ticket-1'],
  );
  render(element);
}

describe('SupportTicketDetailPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('affiche le ticket et son fil de messages', async () => {
    monter(vi.fn(() => Promise.resolve(reponseJson(TICKET))));

    await waitFor(() => {
      expect(screen.getByText('Imprimante hors service')).toBeDefined();
      expect(screen.getByText('Nous regardons ça, merci de patienter.')).toBeDefined();
    });
  });

  it('envoie une réponse', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'POST') {
        return Promise.resolve(
          reponseJson({ id: 'msg-2', corps: 'Merci, réparé.', auteurType: 'TENANT' }, 201),
        );
      }
      return Promise.resolve(reponseJson(TICKET));
    });
    monter(fetchMock);

    await waitFor(() => {
      expect(screen.getByText('Imprimante hors service')).toBeDefined();
    });

    fireEvent.change(screen.getByPlaceholderText('Écrire une réponse…'), {
      target: { value: 'Merci, réparé.' },
    });
    fireEvent.click(screen.getByText('Envoyer'));

    await waitFor(() => {
      const appelReponse = fetchMock.mock.calls.some(
        ([reqInput, reqInit]) =>
          String(reqInput).includes('/support-tickets/ticket-1/messages') &&
          (reqInit as RequestInit | undefined)?.method === 'POST',
      );
      expect(appelReponse).toBe(true);
    });
  });
});
