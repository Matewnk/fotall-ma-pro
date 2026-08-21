import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { renderAvecProviders, reponseJson } from '../test-utils';
import { CustomerTrackingScreen } from './CustomerTrackingScreen';

// require() dans la factory : pattern documenté par le paquet lui-même
// (jest.mock est hoisté avant les imports ES, require() reste la seule
// forme utilisable ici).
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const SUIVI = {
  numero: 42,
  statut: 'EN_COURS' as const,
  total: '2000.00',
  modeLivraison: 'RETRAIT',
  articles: [{ intitule: 'Lavage', quantite: 2, sousTotal: '2000.00' }],
  pressing: { nomPressing: 'Pressing Test', telephone: '+221700000000' },
};

describe('CustomerTrackingScreen', () => {
  it('affiche le suivi quand la commande est trouvée', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(reponseJson(SUIVI)),
    ) as unknown as typeof fetch;

    render(renderAvecProviders(<CustomerTrackingScreen />));

    fireEvent.changeText(screen.getByLabelText('Sous-domaine du pressing'), 'pressing-test');
    fireEvent.changeText(screen.getByLabelText('Numéro de commande'), '42');
    fireEvent.changeText(screen.getByLabelText('Téléphone'), '+221701112233');
    fireEvent.press(screen.getByText('Rechercher'));

    await waitFor(
      () => {
        expect(screen.getByText('Commande #42')).toBeTruthy();
        expect(screen.getByText('Total : 2000.00 FCFA')).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });

  it('affiche un message d’erreur si la commande est introuvable', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(
        reponseJson({ statusCode: 404, message: 'Commande introuvable.' }, false, 404),
      ),
    ) as unknown as typeof fetch;

    render(renderAvecProviders(<CustomerTrackingScreen />));

    fireEvent.changeText(screen.getByLabelText('Sous-domaine du pressing'), 'pressing-test');
    fireEvent.changeText(screen.getByLabelText('Numéro de commande'), '999');
    fireEvent.changeText(screen.getByLabelText('Téléphone'), '+221700000099');
    fireEvent.press(screen.getByText('Rechercher'));

    await waitFor(
      () => {
        expect(screen.getByText('Commande introuvable.')).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });
});
