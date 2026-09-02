import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { SupportPage } from './SupportPage';

const TICKETS = [
  {
    id: 'ticket-1',
    tenantId: 'tenant-1',
    auteurId: 'user-1',
    sujet: 'Imprimante hors service',
    description: "L'imprimante ESC/POS ne répond plus.",
    statut: 'OUVERT' as const,
    priorite: 'HAUTE' as const,
    createdAt: '2026-08-20T10:00:00Z',
    updatedAt: '2026-08-20T10:00:00Z',
  },
];

describe('SupportPage', () => {
  beforeEach(() => {
    localStorage.setItem(
      'fotall.session',
      JSON.stringify({
        accessToken: 'token-admin-123',
        tenant: { id: 'tenant-1', nomPressing: 'Pressing Lumière', sousDomaine: 'lumiere' },
        user: { id: 'user-1', email: 'admin@pressing-lumiere.dev', role: 'ADMIN' },
      }),
    );
  });

  it('affiche la liste des tickets du tenant', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(reponseJson(TICKETS))),
    );
    const { element } = renderAvecProviders(<SupportPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Imprimante hors service')).toBeDefined();
      expect(screen.getByText('Ouvert')).toBeDefined();
    });
  });

  it('crée un nouveau ticket via le formulaire', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'POST') {
        return Promise.resolve(
          reponseJson(
            {
              id: 'ticket-2',
              sujet: 'Question facturation',
              statut: 'OUVERT',
              priorite: 'NORMALE',
            },
            201,
          ),
        );
      }
      return Promise.resolve(reponseJson(TICKETS));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { element } = renderAvecProviders(<SupportPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Imprimante hors service')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Nouveau ticket'));
    fireEvent.change(screen.getByLabelText('Sujet'), {
      target: { value: 'Question facturation' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Le montant prélevé semble incorrect.' },
    });
    fireEvent.click(screen.getByText('Envoyer'));

    await waitFor(() => {
      const appelCreation = fetchMock.mock.calls.some(
        ([input, init]) =>
          String(input).includes('/support-tickets') &&
          (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(appelCreation).toBe(true);
    });
  });
});
