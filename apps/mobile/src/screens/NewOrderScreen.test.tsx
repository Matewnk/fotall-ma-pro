import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { renderAvecProviders, reponseJson } from '../test-utils';
import { NewOrderScreen } from './NewOrderScreen';

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

const CLIENT = { id: 'client-1', nom: 'Fatou Sy', telephone: '+221701112233', statut: 'ACTIF' };
const SERVICE = {
  id: 'service-1',
  code: 'SRV-01',
  intitule: 'Lavage',
  categorie: 'Vêtements',
  tarif: '1000.00',
  actif: true,
};
const COMMANDE_CREEE = {
  id: 'commande-1',
  numero: 42,
  clientId: 'client-1',
  statut: 'EN_ATTENTE',
  sousTotal: '1000.00',
  total: '1000.00',
  modeLivraison: 'RETRAIT',
  createdAt: '2026-08-21T10:00:00Z',
};

function installerFauxServeur() {
  globalThis.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.includes('/clients')) {
      return Promise.resolve(reponseJson([CLIENT]));
    }
    if (url.includes('/services')) {
      return Promise.resolve(reponseJson([SERVICE]));
    }
    if (url.includes('/commandes') && method === 'POST') {
      return Promise.resolve(reponseJson(COMMANDE_CREEE, true, 201));
    }
    return Promise.resolve(reponseJson({}));
  }) as unknown as typeof fetch;
}

describe('NewOrderScreen', () => {
  beforeEach(() => {
    installerFauxServeur();
    mockNavigate.mockClear();
  });

  it('sélectionne un client, ajoute un article au panier, valide la commande et navigue vers l’encaissement', async () => {
    render(renderAvecProviders(<NewOrderScreen />));

    fireEvent.changeText(screen.getByLabelText('Rechercher un client'), 'Fatou');

    await waitFor(
      () => {
        expect(screen.getByText('Fatou Sy')).toBeTruthy();
      },
      { timeout: 5000 },
    );
    fireEvent.press(screen.getByText('Fatou Sy'));

    await waitFor(
      () => {
        expect(screen.getByText('Lavage')).toBeTruthy();
      },
      { timeout: 5000 },
    );
    fireEvent.press(screen.getByText('Lavage'));

    await waitFor(() => {
      expect(screen.getByText('Total estimé : 1000 FCFA')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('VALIDER LA COMMANDE'));

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith('Encaissement', { commandeId: 'commande-1' });
      },
      { timeout: 5000 },
    );
  });
});
