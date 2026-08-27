import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, waitFor } from '@testing-library/react-native';
import { renderAvecProviders, reponseJson } from '../test-utils';
import { UsersScreen } from './UsersScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const SESSION = {
  accessToken: 'token-123',
  tenant: { id: 'tenant-1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
  user: { id: 'user-1', email: 'admin@pressing-test.dev', role: 'ADMIN' as const },
};

const UTILISATEURS = [
  {
    id: 'user-2',
    email: 'caissier@pressing-test.dev',
    role: 'CAISSIER' as const,
    actif: true,
    createdAt: '2026-08-01T00:00:00Z',
  },
];

function installerFauxServeur() {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/users')) {
      return Promise.resolve(reponseJson(UTILISATEURS));
    }
    return Promise.resolve(reponseJson({}));
  }) as jest.Mock;
}

describe('UsersScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem('fotall.session', JSON.stringify(SESSION));
  });

  it('affiche la liste des utilisateurs et le nombre de comptes actifs', async () => {
    installerFauxServeur();
    render(renderAvecProviders(<UsersScreen />));

    await waitFor(
      () => {
        expect(screen.getByText('caissier@pressing-test.dev')).toBeTruthy();
        expect(screen.getByText('1 compte(s) actif(s)')).toBeTruthy();
      },
      { timeout: 10000 },
    );
  });
});
