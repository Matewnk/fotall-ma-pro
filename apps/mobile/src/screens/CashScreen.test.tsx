import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, waitFor } from '@testing-library/react-native';
import { renderAvecProviders, reponseJson } from '../test-utils';
import { CashScreen } from './CashScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const SESSION = {
  accessToken: 'token-123',
  tenant: { id: 'tenant-1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
  user: { id: 'user-1', email: 'admin@pressing-test.dev', role: 'ADMIN' as const },
};

const OPERATIONS = [
  {
    id: 'op-1',
    type: 'ENCAISSEMENT' as const,
    montant: '2400.00',
    modePaiement: 'ESPECES' as const,
    createdAt: '2026-08-26T10:00:00Z',
  },
];

function installerFauxServeur() {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/caisse/solde')) {
      return Promise.resolve(reponseJson({ solde: '15000.00' }));
    }
    if (url.includes('/caisse/operations')) {
      return Promise.resolve(reponseJson(OPERATIONS));
    }
    if (url.includes('/commandes')) {
      return Promise.resolve(reponseJson([]));
    }
    return Promise.resolve(reponseJson({}));
  }) as jest.Mock;
}

describe('CashScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem('fotall.session', JSON.stringify(SESSION));
  });

  it('affiche le solde et le journal des opérations', async () => {
    installerFauxServeur();
    render(renderAvecProviders(<CashScreen />));

    await waitFor(
      () => {
        expect(screen.getByText('15000.00 FCFA')).toBeTruthy();
        expect(screen.getByText('Encaissement')).toBeTruthy();
      },
      { timeout: 10000 },
    );
  });
});
