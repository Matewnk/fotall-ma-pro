import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { SuperAdminSupportPage } from './SuperAdminSupportPage';

const TICKETS = [
  {
    id: 'ticket-1',
    tenantId: 'tenant-1',
    auteurId: 'user-1',
    sujet: 'Imprimante hors service',
    description: '...',
    statut: 'OUVERT' as const,
    priorite: 'HAUTE' as const,
    createdAt: '2026-08-20T10:00:00Z',
    updatedAt: '2026-08-20T10:00:00Z',
    tenant: { nomPressing: 'Pressing Lumière' },
  },
  {
    id: 'ticket-2',
    tenantId: 'tenant-2',
    auteurId: 'user-2',
    sujet: 'Question facturation',
    description: '...',
    statut: 'RESOLU' as const,
    priorite: 'NORMALE' as const,
    createdAt: '2026-08-19T10:00:00Z',
    updatedAt: '2026-08-19T10:00:00Z',
    tenant: { nomPressing: 'Aqua Pressing' },
  },
];

describe('SuperAdminSupportPage', () => {
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
      vi.fn(() => Promise.resolve(reponseJson(TICKETS))),
    );
  });

  it('affiche les tickets de tous les tenants', async () => {
    const { element } = renderAvecProviders(<SuperAdminSupportPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Imprimante hors service')).toBeDefined();
      expect(screen.getByText('Pressing Lumière')).toBeDefined();
      expect(screen.getByText('Aqua Pressing')).toBeDefined();
    });
  });

  it('filtre par recherche et par statut', async () => {
    const { element } = renderAvecProviders(<SuperAdminSupportPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Imprimante hors service')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Rechercher un ticket'), {
      target: { value: 'facturation' },
    });
    await waitFor(() => {
      expect(screen.getByText('Question facturation')).toBeDefined();
      expect(screen.queryByText('Imprimante hors service')).toBeNull();
    });

    fireEvent.change(screen.getByLabelText('Rechercher un ticket'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'OUVERT' } });
    await waitFor(() => {
      expect(screen.getByText('Imprimante hors service')).toBeDefined();
      expect(screen.queryByText('Question facturation')).toBeNull();
    });
  });
});
