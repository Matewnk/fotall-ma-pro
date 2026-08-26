import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, waitFor } from '@testing-library/react-native';
import { renderAvecProviders, reponseJson } from '../test-utils';
import { ReportsScreen } from './ReportsScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const SESSION = {
  accessToken: 'token-123',
  tenant: { id: 'tenant-1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
  user: { id: 'user-1', email: 'admin@pressing-test.dev', role: 'ADMIN' as const },
};

const RAPPORT = {
  colonnes: ['Type', 'Montant'],
  lignes: [['Encaissement', '2400.00']],
  resume: { soldeOuverture: '15000.00', soldeCloture: '17400.00' },
};

function installerFauxServeur() {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/rapports/caisse-quotidienne')) {
      return Promise.resolve(reponseJson(RAPPORT));
    }
    return Promise.resolve(reponseJson({}));
  }) as jest.Mock;
}

describe('ReportsScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem('fotall.session', JSON.stringify(SESSION));
  });

  it('affiche le résumé et le tableau du rapport par défaut', async () => {
    installerFauxServeur();
    render(renderAvecProviders(<ReportsScreen />));

    await waitFor(
      () => {
        expect(screen.getByText("Solde d'ouverture")).toBeTruthy();
        expect(screen.getByText('Encaissement')).toBeTruthy();
      },
      { timeout: 10000 },
    );
  });
});
