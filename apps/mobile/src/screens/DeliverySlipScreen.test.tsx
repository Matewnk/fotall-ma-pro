import { render, screen, waitFor } from '@testing-library/react-native';
import { renderAvecProviders, reponseJson } from '../test-utils';
import { DeliverySlipScreen } from './DeliverySlipScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useRoute: () => ({ params: { commandeId: 'commande-2' } }),
}));

const TICKET_DATA = {
  numero: 9822,
  estProvisoire: false,
  nomPressing: 'Pressing Test',
  adresseTenant: '12 rue Test',
  telephoneTenant: '+221770000000',
  logoUrl: null,
  client: { nom: 'Awa Diop', telephone: '+221701112233' },
  articles: [
    { intitule: 'Chemise sur cintre', quantite: 2, tarifUnitaire: '1000', sousTotal: '2000' },
    { intitule: 'Costume 2 pièces', quantite: 1, tarifUnitaire: '5000', sousTotal: '5000' },
  ],
  sousTotal: '7000',
  remise: '0',
  total: '7000',
  datePrevue: '2026-08-25T00:00:00.000Z',
  modeLivraison: 'LIVRAISON',
  adresseLivraison: '45 rue des Fleurs, Dakar',
  statut: 'PRET',
};

function installerFauxServeur() {
  globalThis.fetch = jest.fn(() =>
    Promise.resolve(reponseJson(TICKET_DATA)),
  ) as unknown as typeof fetch;
}

describe('DeliverySlipScreen', () => {
  beforeEach(() => {
    installerFauxServeur();
  });

  it('affiche les informations client, les articles et le total articles', async () => {
    render(renderAvecProviders(<DeliverySlipScreen />));

    await waitFor(() => {
      expect(screen.getByText('BON DE LIVRAISON')).toBeTruthy();
    });

    expect(screen.getByText('#9822')).toBeTruthy();
    expect(screen.getByText('Awa Diop')).toBeTruthy();
    expect(screen.getByText('45 rue des Fleurs, Dakar')).toBeTruthy();
    expect(screen.getByText('2x Chemise sur cintre')).toBeTruthy();
    expect(screen.getByText('1x Costume 2 pièces')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy(); // total articles = 2 + 1
  });
});
