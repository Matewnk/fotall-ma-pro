import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, waitFor } from '@testing-library/react-native';
import { renderAvecProviders, reponseJson } from '../test-utils';
import { BrandingScreen } from './BrandingScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const SESSION = {
  accessToken: 'token-123',
  tenant: { id: 'tenant-1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
  user: { id: 'user-1', email: 'admin@pressing-test.dev', role: 'ADMIN' as const },
};

const TENANT = {
  id: 'tenant-1',
  nomPressing: 'Pressing Test',
  sousDomaine: 'pressing-test',
  adresse: '12 rue Exemple',
  telephone: '+221000000',
  langue: 'fr',
  devise: 'XOF',
  fuseauHoraire: 'Africa/Dakar',
};

function installerFauxServeur() {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/tenant')) {
      return Promise.resolve(reponseJson(TENANT));
    }
    return Promise.resolve(reponseJson({}));
  }) as jest.Mock;
}

describe('BrandingScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem('fotall.session', JSON.stringify(SESSION));
  });

  it('affiche les informations du tenant', async () => {
    installerFauxServeur();
    render(renderAvecProviders(<BrandingScreen />));

    await waitFor(
      () => {
        expect(screen.getByDisplayValue('Pressing Test')).toBeTruthy();
        expect(screen.getByDisplayValue('12 rue Exemple')).toBeTruthy();
      },
      { timeout: 10000 },
    );
  });
});
