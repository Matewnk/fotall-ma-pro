import { render, screen, waitFor } from '@testing-library/react-native';
import { renderAvecProviders, reponseJson } from '../test-utils';
import { TicketScreen } from './TicketScreen';

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
  ],
  sousTotal: '2000',
  remise: '0',
  total: '2000',
  datePrevue: null,
  modeLivraison: 'RETRAIT',
  adresseLivraison: null,
  statut: 'EN_ATTENTE',
};

function installerFauxServeur() {
  globalThis.fetch = jest.fn(() =>
    Promise.resolve(reponseJson(TICKET_DATA)),
  ) as unknown as typeof fetch;
}

describe('TicketScreen', () => {
  beforeEach(() => {
    installerFauxServeur();
  });

  it('affiche le numéro de commande, le client et le total', async () => {
    render(renderAvecProviders(<TicketScreen />));

    await waitFor(() => {
      expect(screen.getByText('TICKET DE CAISSE')).toBeTruthy();
    });

    expect(screen.getByText('#9822')).toBeTruthy();
    expect(screen.getByText('Awa Diop')).toBeTruthy();
    expect(screen.getByText('2x Chemise sur cintre')).toBeTruthy();
    expect(screen.getAllByText('2000 FCFA').length).toBeGreaterThan(0);
  });
});
