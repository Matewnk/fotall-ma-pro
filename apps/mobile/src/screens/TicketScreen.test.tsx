import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, waitFor } from '@testing-library/react-native';
import { writeAsStringAsync } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { renderAvecProviders } from '../test-utils';
import { TicketScreen } from './TicketScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useRoute: () => ({ params: { commandeId: 'commande-2' } }),
}));

// jest.fn() défini directement dans la factory (pas via une const externe
// référencée par closure) : évite un piège de timing d'initialisation où
// la factory, invoquée dès le require() de TicketScreen.tsx, s'exécute
// avant qu'une const externe déclarée plus bas dans le fichier n'ait été
// assignée (capturait alors `undefined` dans l'objet retourné).
jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => Promise.resolve(true),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

const SESSION = {
  accessToken: 'token-123',
  tenant: { id: 'tenant-1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
  user: { id: 'user-1', email: 'caissier@pressing-test.dev', role: 'CAISSIER' as const },
};

// "FAKE" (F=70, A=65, K=75, E=69) encodé en base64 = "RkFLRQ==".
const OCTETS_FAKE = new Uint8Array([70, 65, 75, 69]);

function installerFauxServeur() {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(OCTETS_FAKE.buffer),
    }),
  ) as unknown as typeof fetch;
}

describe('TicketScreen', () => {
  beforeEach(async () => {
    (writeAsStringAsync as jest.Mock).mockClear();
    (shareAsync as jest.Mock).mockClear();
    installerFauxServeur();
    await AsyncStorage.setItem('fotall.session', JSON.stringify(SESSION));
  });

  it('télécharge le PDF du ticket avec authentification puis ouvre la feuille de partage', async () => {
    render(renderAvecProviders(<TicketScreen />));

    await waitFor(() => {
      expect(screen.getByText('Ticket prêt.')).toBeTruthy();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/commandes/commande-2/ticket/pdf'),
      { headers: { Authorization: 'Bearer token-123' } },
    );
    expect(writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('ticket-commande-2.pdf'),
      'RkFLRQ==',
      { encoding: 'base64' },
    );
    expect(shareAsync).toHaveBeenCalledWith(expect.stringContaining('ticket-commande-2.pdf'), {
      mimeType: 'application/pdf',
      dialogTitle: 'Ticket',
    });
  });
});
