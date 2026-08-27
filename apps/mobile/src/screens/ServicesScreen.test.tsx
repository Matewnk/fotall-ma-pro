import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, waitFor } from '@testing-library/react-native';
import { renderAvecProviders, reponseJson } from '../test-utils';
import { ServicesScreen } from './ServicesScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const SESSION = {
  accessToken: 'token-123',
  tenant: { id: 'tenant-1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
  user: { id: 'user-1', email: 'admin@pressing-test.dev', role: 'ADMIN' as const },
};

const SERVICES = [
  {
    id: 'service-1',
    code: 'SRV-01',
    intitule: 'Lavage classique',
    categorie: 'Lavage',
    delaiHeures: 24,
    tarif: '1500.00',
    icone: 'local_laundry_service',
    actif: true,
  },
];

function installerFauxServeur() {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/services')) {
      return Promise.resolve(reponseJson(SERVICES));
    }
    return Promise.resolve(reponseJson({}));
  }) as jest.Mock;
}

describe('ServicesScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem('fotall.session', JSON.stringify(SESSION));
  });

  it('affiche la liste des services et les KPI', async () => {
    installerFauxServeur();
    render(renderAvecProviders(<ServicesScreen />));

    await waitFor(
      () => {
        expect(screen.getByText('Lavage classique')).toBeTruthy();
        expect(screen.getByText('Services actifs')).toBeTruthy();
      },
      { timeout: 10000 },
    );
  });
});
