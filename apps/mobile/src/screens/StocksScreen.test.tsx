import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, waitFor } from '@testing-library/react-native';
import { renderAvecProviders, reponseJson } from '../test-utils';
import { StocksScreen } from './StocksScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const SESSION = {
  accessToken: 'token-123',
  tenant: { id: 'tenant-1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
  user: { id: 'user-1', email: 'admin@pressing-test.dev', role: 'ADMIN' as const },
};

const ARTICLES = [
  {
    id: 'article-1',
    code: 'DET-05L-PRO',
    intitule: 'Détergent professionnel',
    unite: 'bidons (5L)',
    seuil: 3,
    icone: 'science',
    actif: true,
    quantite: 1,
    enAlerte: true,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  },
];

function installerFauxServeur() {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/stocks/articles/mouvements')) {
      return Promise.resolve(reponseJson([]));
    }
    if (url.includes('/stocks/articles')) {
      return Promise.resolve(reponseJson(ARTICLES));
    }
    return Promise.resolve(reponseJson({}));
  }) as jest.Mock;
}

describe('StocksScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem('fotall.session', JSON.stringify(SESSION));
  });

  it("affiche les articles et l'alerte de stock bas", async () => {
    installerFauxServeur();
    render(renderAvecProviders(<StocksScreen />));

    await waitFor(
      () => {
        expect(screen.getByText('Détergent professionnel')).toBeTruthy();
        expect(screen.getByText('Stock bas')).toBeTruthy();
      },
      { timeout: 10000 },
    );
  });
});
