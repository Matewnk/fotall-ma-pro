import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { renderAvecProviders, reponseJson } from '../test-utils';
import { OrdersStatusScreen } from './OrdersStatusScreen';

// require() dans la factory : pattern documenté par le paquet lui-même
// (jest.mock est hoisté avant les imports ES, require() reste la seule
// forme utilisable ici).
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const COMMANDE_EN_COURS = {
  id: 'commande-1',
  numero: 9821,
  clientId: 'client-1',
  statut: 'EN_COURS',
  sousTotal: '3500.00',
  total: '3500.00',
  modeLivraison: 'RETRAIT',
  createdAt: '2026-08-21T10:00:00Z',
};
const COMMANDE_PRETE = { ...COMMANDE_EN_COURS, statut: 'PRET' };

function installerFauxServeur() {
  let commandes = [COMMANDE_EN_COURS];
  globalThis.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.includes('/statut') && method === 'PATCH') {
      commandes = commandes.map((c) => (c.id === 'commande-1' ? COMMANDE_PRETE : c));
      return Promise.resolve(reponseJson(COMMANDE_PRETE));
    }
    return Promise.resolve(reponseJson(commandes));
  }) as unknown as typeof fetch;
}

describe('OrdersStatusScreen', () => {
  beforeEach(() => {
    installerFauxServeur();
  });

  it('affiche les commandes et fait avancer le statut', async () => {
    render(renderAvecProviders(<OrdersStatusScreen />));

    // "En cours"/"Prêt" apparaissent à la fois dans les onglets de filtre
    // et dans le badge de statut de la carte — getAllByText nécessaire.
    await waitFor(
      () => {
        expect(screen.getByText('#9821')).toBeTruthy();
        expect(screen.getAllByText('En cours')).toHaveLength(2);
      },
      { timeout: 5000 },
    );

    fireEvent.press(screen.getByText('Marquer prêt'));

    await waitFor(
      () => {
        expect(screen.getAllByText('Prêt')).toHaveLength(2);
      },
      { timeout: 5000 },
    );
  });

  it('filtre par statut', async () => {
    render(renderAvecProviders(<OrdersStatusScreen />));

    await waitFor(
      () => {
        expect(screen.getByText('#9821')).toBeTruthy();
      },
      { timeout: 5000 },
    );

    fireEvent.press(screen.getByText('En attente'));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('statut=EN_ATTENTE'),
        expect.anything(),
      );
    });
  });
});
