import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { renderAvecProviders, reponseJson } from '../test-utils';
import { LoginScreen } from './LoginScreen';

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

describe('LoginScreen', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  it('se connecte avec sous-domaine + email + mot de passe', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(reponseJson(SESSION));

    render(renderAvecProviders(<LoginScreen />));

    fireEvent.changeText(screen.getByLabelText('Sous-domaine'), 'pressing-test');
    fireEvent.changeText(screen.getByLabelText('Email'), 'caissier@pressing-test.dev');
    fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'super-secret-1');
    fireEvent.press(screen.getByText('Se connecter'));

    // Timeout au-delà du défaut RNTL (1000ms), voir AccountScreen.test.tsx.
    await waitFor(
      () => {
        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/login'),
          expect.objectContaining({ method: 'POST' }),
        );
      },
      { timeout: 5000 },
    );
  });

  it('affiche le message d’erreur du serveur sur identifiants invalides', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      reponseJson({ statusCode: 401, message: 'Identifiants invalides.' }, false, 401),
    );

    render(renderAvecProviders(<LoginScreen />));

    fireEvent.changeText(screen.getByLabelText('Sous-domaine'), 'pressing-test');
    fireEvent.changeText(screen.getByLabelText('Email'), 'caissier@pressing-test.dev');
    fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'faux');
    fireEvent.press(screen.getByText('Se connecter'));

    await waitFor(
      () => {
        expect(screen.getByText('Identifiants invalides.')).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });
});
