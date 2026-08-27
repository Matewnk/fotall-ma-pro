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

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

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
const COMMANDE_LIVRAISON = {
  ...COMMANDE_EN_COURS,
  id: 'commande-2',
  numero: 9822,
  modeLivraison: 'LIVRAISON',
};

function installerFauxServeur(commandesInitiales = [COMMANDE_EN_COURS]) {
  let commandes = commandesInitiales;
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
    mockNavigate.mockClear();
  });

  it('affiche les commandes et fait avancer le statut', async () => {
    render(renderAvecProviders(<OrdersStatusScreen />));

    // "En cours"/"Terminé" apparaissent à la fois dans les onglets de filtre
    // et dans le badge de statut de la carte — getAllByText nécessaire.
    await waitFor(
      () => {
        expect(screen.getByText('#9821')).toBeTruthy();
        expect(screen.getAllByText('En cours')).toHaveLength(2);
      },
      { timeout: 5000 },
    );

    fireEvent.press(screen.getByText('Marquer terminé'));

    await waitFor(
      () => {
        expect(screen.getAllByText('Terminé')).toHaveLength(2);
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

  it('propose "Bon de livraison" uniquement pour une commande en mode LIVRAISON, et navigue vers l’écran dédié', async () => {
    installerFauxServeur([COMMANDE_EN_COURS, COMMANDE_LIVRAISON]);
    render(renderAvecProviders(<OrdersStatusScreen />));

    await waitFor(
      () => {
        expect(screen.getByText('#9822')).toBeTruthy();
      },
      { timeout: 5000 },
    );

    expect(screen.getAllByText('Bon de livraison')).toHaveLength(1);

    fireEvent.press(screen.getByText('Bon de livraison'));

    expect(mockNavigate).toHaveBeenCalledWith('BonLivraison', { commandeId: 'commande-2' });
  });
});
