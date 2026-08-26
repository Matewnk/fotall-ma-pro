import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, waitFor } from '@testing-library/react-native';
import { renderAvecProviders, reponseJson } from '../test-utils';
import { DashboardScreen } from './DashboardScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const SESSION = {
  accessToken: 'token-123',
  tenant: { id: 'tenant-1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
  user: { id: 'user-1', email: 'admin@pressing-test.dev', role: 'ADMIN' as const },
};

const DASHBOARD = {
  kpis: {
    commandesDuJour: 5,
    chiffreAffairesDuJour: '25000.00',
    articlesEnAttente: 3,
    livraisonsPrevuesAujourdHui: 2,
    commandesEnRetard: 1,
    revenus7DerniersJours: [],
  },
  commandesRecentes: [
    {
      numero: 12,
      client: { id: 'client-1', nom: 'Awa Diop' },
      date: '2026-08-26T10:00:00Z',
      montant: '2400.00',
      statut: 'EN_ATTENTE' as const,
    },
  ],
  alertes: {
    commandesUrgentes: 0,
    retards: 1,
    paiementsEnAttente: 0,
    livraisonsDuJour: 2,
    erreursSynchronisation: 0,
    licenceProcheExpiration: { active: false, joursRestants: null },
  },
};

describe('DashboardScreen', () => {
  it('affiche les KPIs et les commandes récentes', async () => {
    await AsyncStorage.setItem('fotall.session', JSON.stringify(SESSION));
    global.fetch = jest.fn(() => Promise.resolve(reponseJson(DASHBOARD))) as jest.Mock;

    render(renderAvecProviders(<DashboardScreen />));

    await waitFor(
      () => {
        expect(screen.getByText('Tableau de bord')).toBeTruthy();
        expect(screen.getByText('5')).toBeTruthy();
        expect(screen.getByText('Awa Diop')).toBeTruthy();
      },
      { timeout: 10000 },
    );
  });
});
