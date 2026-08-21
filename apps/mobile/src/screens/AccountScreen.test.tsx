import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { renderAvecProviders } from '../test-utils';
import { AccountScreen } from './AccountScreen';

// require() dans la factory : pattern documenté par le paquet lui-même
// (jest.mock est hoisté avant les imports ES, require() reste la seule
// forme utilisable ici).
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const SESSION = {
  accessToken: 'token-123',
  tenant: { id: 'tenant-1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
  user: { id: 'user-1', email: 'caissier@pressing-test.dev', role: 'CAISSIER' as const },
};

describe('AccountScreen', () => {
  it('affiche les informations de la session et se déconnecte', async () => {
    await AsyncStorage.setItem('fotall.session', JSON.stringify(SESSION));

    render(renderAvecProviders(<AccountScreen />));

    // Timeout au-delà du défaut RNTL (1000ms) : la lecture initiale
    // d'AsyncStorage passe par AuthProvider (useEffect + Promise), lent
    // sous contention CPU quand ce projet Jest tourne en parallèle du
    // projet "offline" (WatermelonDB/LokiJS, cold-start également lent —
    // voir jest.setup.ts).
    await waitFor(
      () => {
        expect(screen.getByText('Pressing Test')).toBeTruthy();
        expect(screen.getByText('caissier@pressing-test.dev')).toBeTruthy();
      },
      { timeout: 5000 },
    );

    fireEvent.press(screen.getByText('Déconnexion'));

    await waitFor(
      async () => {
        expect(await AsyncStorage.getItem('fotall.session')).toBeNull();
      },
      { timeout: 5000 },
    );
  });
});
