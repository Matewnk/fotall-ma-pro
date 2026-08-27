import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, waitFor } from '@testing-library/react-native';
import { downloadAsync } from 'expo-file-system';
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
  downloadAsync: jest.fn(() => Promise.resolve({ uri: 'file:///cache/ticket-commande-2.pdf' })),
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

describe('TicketScreen', () => {
  beforeEach(async () => {
    (downloadAsync as jest.Mock).mockClear();
    (shareAsync as jest.Mock).mockClear();
    await AsyncStorage.setItem('fotall.session', JSON.stringify(SESSION));
  });

  it('télécharge le PDF du ticket avec authentification puis ouvre la feuille de partage', async () => {
    render(renderAvecProviders(<TicketScreen />));

    await waitFor(() => {
      expect(screen.getByText('Ticket prêt.')).toBeTruthy();
    });

    expect(downloadAsync).toHaveBeenCalledWith(
      expect.stringContaining('/commandes/commande-2/ticket/pdf'),
      expect.stringContaining('ticket-commande-2.pdf'),
      { headers: { Authorization: 'Bearer token-123' } },
    );
    expect(shareAsync).toHaveBeenCalledWith('file:///cache/ticket-commande-2.pdf', {
      mimeType: 'application/pdf',
      dialogTitle: 'Ticket',
    });
  });
});
