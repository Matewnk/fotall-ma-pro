import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { SuperAdminUsersPage } from './SuperAdminUsersPage';

const UTILISATEURS = [
  {
    id: 'user-1',
    email: 'admin@pressing-lumiere.dev',
    role: 'ADMIN' as const,
    actif: true,
    createdAt: '2026-01-01T00:00:00Z',
    tenant: { id: 'tenant-1', nomPressing: 'Pressing Lumière' },
  },
  {
    id: 'user-2',
    email: 'caissier@aqua-pressing.dev',
    role: 'CAISSIER' as const,
    actif: false,
    createdAt: '2026-03-01T00:00:00Z',
    tenant: { id: 'tenant-2', nomPressing: 'Aqua Pressing' },
  },
];

describe('SuperAdminUsersPage', () => {
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
      vi.fn(() => Promise.resolve(reponseJson(UTILISATEURS))),
    );
  });

  it('affiche les utilisateurs de tous les tenants', async () => {
    const { element } = renderAvecProviders(<SuperAdminUsersPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('admin@pressing-lumiere.dev')).toBeDefined();
      expect(screen.getByText('caissier@aqua-pressing.dev')).toBeDefined();
      expect(screen.getByText('Pressing Lumière')).toBeDefined();
      expect(screen.getByText('Aqua Pressing')).toBeDefined();
    });
  });

  it('filtre par recherche, rôle et statut', async () => {
    const { element } = renderAvecProviders(<SuperAdminUsersPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('admin@pressing-lumiere.dev')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Rechercher un utilisateur'), {
      target: { value: 'aqua' },
    });
    await waitFor(() => {
      expect(screen.getByText('caissier@aqua-pressing.dev')).toBeDefined();
      expect(screen.queryByText('admin@pressing-lumiere.dev')).toBeNull();
    });

    fireEvent.change(screen.getByLabelText('Rechercher un utilisateur'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Rôle'), { target: { value: 'ADMIN' } });
    await waitFor(() => {
      expect(screen.getByText('admin@pressing-lumiere.dev')).toBeDefined();
      expect(screen.queryByText('caissier@aqua-pressing.dev')).toBeNull();
    });

    fireEvent.change(screen.getByLabelText('Rôle'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'INACTIF' } });
    await waitFor(() => {
      expect(screen.getByText('caissier@aqua-pressing.dev')).toBeDefined();
      expect(screen.queryByText('admin@pressing-lumiere.dev')).toBeNull();
    });
  });

  it('affiche un badge de statut distinct pour actif/inactif', async () => {
    const { element } = renderAvecProviders(<SuperAdminUsersPage />);
    render(element);

    await waitFor(() => {
      const table = screen.getByRole('table');
      expect(within(table).getByText('Actif')).toBeDefined();
      expect(within(table).getByText('Inactif')).toBeDefined();
    });
  });
});
