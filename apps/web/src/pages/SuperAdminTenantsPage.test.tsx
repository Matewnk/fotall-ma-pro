import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    proprietaire: 'admin@pressing-lumiere.dev',
    nombreUtilisateurs: 4,
    licence: { statut: 'ACTIVE' as const, dateFinEssai: '2026-01-15T00:00:00Z' },
  },
  {
    id: 'tenant-2',
    nomPressing: 'Aqua Pressing',
    sousDomaine: 'aqua-pressing',
    plan: 'STARTER' as const,
    createdAt: '2026-03-01T00:00:00Z',
    proprietaire: 'admin@aqua-pressing.dev',
    nombreUtilisateurs: 1,
    licence: { statut: 'ESSAI' as const, dateFinEssai: '2026-03-15T00:00:00Z' },
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
      expect(within(screen.getByRole('table')).getByText('Active')).toBeDefined();
    });
  });

  it('filtre les tenants via la barre de recherche', async () => {
    const { element } = renderAvecProviders(<SuperAdminTenantsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Pressing Lumière')).toBeDefined();
      expect(screen.getByText('Aqua Pressing')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Rechercher un tenant'), {
      target: { value: 'aqua' },
    });

    await waitFor(() => {
      expect(screen.getByText('Aqua Pressing')).toBeDefined();
      expect(screen.queryByText('Pressing Lumière')).toBeNull();
    });
  });

  it('filtre les tenants par plan et par statut de licence', async () => {
    const { element } = renderAvecProviders(<SuperAdminTenantsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Pressing Lumière')).toBeDefined();
      expect(screen.getByText('Aqua Pressing')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'STARTER' } });

    await waitFor(() => {
      expect(screen.getByText('Aqua Pressing')).toBeDefined();
      expect(screen.queryByText('Pressing Lumière')).toBeNull();
    });

    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Statut licence'), { target: { value: 'ACTIVE' } });

    await waitFor(() => {
      expect(screen.getByText('Pressing Lumière')).toBeDefined();
      expect(screen.queryByText('Aqua Pressing')).toBeNull();
    });
  });

  it('trie les tenants par colonne au clic sur l’en-tête', async () => {
    const { element } = renderAvecProviders(<SuperAdminTenantsPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Pressing Lumière')).toBeDefined();
    });

    // Tri par défaut : "Créé le" décroissant -> Aqua Pressing (mars) avant
    // Pressing Lumière (janvier).
    let lignes = screen.getAllByRole('row').slice(1);
    expect(lignes[0]?.textContent).toContain('Aqua Pressing');

    fireEvent.click(screen.getByText('Tenant'));

    await waitFor(() => {
      lignes = screen.getAllByRole('row').slice(1);
      expect(lignes[0]?.textContent).toContain('Aqua Pressing');
      expect(lignes[1]?.textContent).toContain('Pressing Lumière');
    });
  });
});
