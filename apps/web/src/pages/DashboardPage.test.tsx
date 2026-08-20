import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson } from '../test-utils';
import { renderAvecProviders } from '../test-utils';
import { DashboardPage } from './DashboardPage';

const DASHBOARD_MOCK = {
  kpis: {
    commandesDuJour: 3,
    chiffreAffairesDuJour: '4500',
    articlesEnAttente: 7,
    livraisonsPrevuesAujourdHui: 1,
    commandesEnRetard: 0,
    revenus7DerniersJours: [],
  },
  commandesRecentes: [
    {
      numero: 12,
      client: { id: 'client-1', nom: 'Fatou Sy' },
      date: '2026-08-19T10:00:00Z',
      montant: '1500',
      statut: 'EN_COURS' as const,
    },
  ],
  alertes: {
    commandesUrgentes: 0,
    retards: 0,
    paiementsEnAttente: 2,
    livraisonsDuJour: 1,
    erreursSynchronisation: 0,
    licenceProcheExpiration: { active: true, joursRestants: 2 },
  },
};

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.setItem(
      'fotall.session',
      JSON.stringify({
        accessToken: 'token-123',
        tenant: { id: 't1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
        user: { id: 'u1', email: 'admin@pressing-test.dev', role: 'ADMIN' },
      }),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponseJson(DASHBOARD_MOCK)));
  });

  it('affiche les KPIs, l’alerte de licence et les commandes récentes', async () => {
    const { element } = renderAvecProviders(<DashboardPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Fatou Sy')).toBeDefined();
    });

    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText(/4500 FCFA/)).toBeDefined();
    expect(screen.getByText(/Il reste 2 jour/)).toBeDefined();
  });
});
