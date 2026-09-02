import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { SuperAdminPlansPage } from './SuperAdminPlansPage';

const PLANS = [
  {
    id: 'plan-1',
    plan: 'STARTER' as const,
    prixMensuel: null,
    devise: 'XOF',
    limiteUtilisateurs: null,
    limitePointsDeService: null,
    fonctionnalites: [],
    nombreTenants: 3,
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'plan-2',
    plan: 'PRO' as const,
    prixMensuel: 15000,
    devise: 'XOF',
    limiteUtilisateurs: 10,
    limitePointsDeService: 3,
    fonctionnalites: ['Caisse', 'Tickets'],
    nombreTenants: 5,
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'plan-3',
    plan: 'BUSINESS' as const,
    prixMensuel: 35000,
    devise: 'XOF',
    limiteUtilisateurs: null,
    limitePointsDeService: null,
    fonctionnalites: [],
    nombreTenants: 1,
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

describe('SuperAdminPlansPage', () => {
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
      vi.fn(() => Promise.resolve(reponseJson(PLANS))),
    );
  });

  it('affiche les 3 plans avec leur prix, limites et nombre de tenants', async () => {
    const { element } = renderAvecProviders(<SuperAdminPlansPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeDefined();
      expect(screen.getByText('Non configuré')).toBeDefined();
      expect(screen.getByText('15 000 XOF / mois')).toBeDefined();
      expect(screen.getByText('5 tenant(s)')).toBeDefined();
      expect(screen.getByText('Caisse')).toBeDefined();
    });
  });

  it('ouvre le formulaire de modification et enregistre les nouvelles valeurs', async () => {
    const { element } = renderAvecProviders(<SuperAdminPlansPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeDefined();
    });

    const boutonsModifier = screen.getAllByText('Modifier');
    fireEvent.click(boutonsModifier[0] as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('Enregistrer')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Prix mensuel'), { target: { value: '5000' } });
    fireEvent.click(screen.getByText('Enregistrer'));

    await waitFor(() => {
      const appelPut = vi
        .mocked(fetch)
        .mock.calls.some(
          ([input, init]) =>
            String(input).includes('/super-admin/plans/STARTER') &&
            (init as RequestInit | undefined)?.method === 'PUT',
        );
      expect(appelPut).toBe(true);
    });
  });
});
