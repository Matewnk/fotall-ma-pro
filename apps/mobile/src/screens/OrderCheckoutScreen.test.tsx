import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { renderAvecProviders, reponseJson } from '../test-utils';
import { OrderCheckoutScreen } from './OrderCheckoutScreen';

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
  useRoute: () => ({ params: { commandeId: 'commande-1' } }),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const CLIENT = { id: 'client-1', nom: 'Fatou Sy', telephone: '+221701112233' };
const SERVICE = { id: 'service-1', code: 'SRV-01', intitule: 'Lavage', tarif: '5000.00' };
const COMMANDE = {
  id: 'commande-1',
  numero: 42,
  clientId: 'client-1',
  statut: 'EN_ATTENTE',
  sousTotal: '10000',
  total: '10000',
  modeLivraison: 'RETRAIT',
  articles: [
    { id: 'art-1', serviceId: 'service-1', quantite: 2, tarifUnitaire: '5000', sousTotal: '10000' },
  ],
  createdAt: '2026-08-19T10:00:00Z',
};

function installerFauxServeur(
  options: {
    operationsExistantes?: unknown[];
    encaissementReponse?: { ok: boolean; status: number; corps: unknown };
  } = {},
) {
  const operationsExistantes = options.operationsExistantes ?? [];
  globalThis.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.includes('/commandes/commande-1')) {
      return Promise.resolve(reponseJson(COMMANDE));
    }
    if (url.includes('/clients/client-1')) {
      return Promise.resolve(reponseJson(CLIENT));
    }
    if (url.includes('/services')) {
      return Promise.resolve(reponseJson([SERVICE]));
    }
    if (url.includes('/caisse/operations') && method === 'POST') {
      const reponse = options.encaissementReponse ?? {
        ok: true,
        status: 201,
        corps: { id: 'op-1', type: 'ENCAISSEMENT', montant: '10000', monnaie: '5000' },
      };
      return Promise.resolve(reponseJson(reponse.corps, reponse.ok, reponse.status));
    }
    if (url.includes('/caisse/operations')) {
      return Promise.resolve(reponseJson(operationsExistantes));
    }
    return Promise.resolve(reponseJson({}));
  }) as unknown as typeof fetch;
}

describe('OrderCheckoutScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('affiche le total en lecture seule dérivé de la commande', async () => {
    installerFauxServeur();
    render(renderAvecProviders(<OrderCheckoutScreen />));

    await waitFor(() => {
      expect(screen.getByText('Fatou Sy')).toBeTruthy();
    });
    expect(screen.getAllByText('10000 FCFA').length).toBeGreaterThan(0);
  });

  it('calcule la monnaie à partir du montant reçu saisi', async () => {
    installerFauxServeur();
    render(renderAvecProviders(<OrderCheckoutScreen />));

    await waitFor(() => {
      expect(screen.getByLabelText('Montant reçu')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText('Montant reçu'), '15000');

    await waitFor(() => {
      expect(screen.getByText('5000 FCFA')).toBeTruthy();
    });
  });

  it('encaisse la commande en envoyant montantRecu (jamais un montant)', async () => {
    installerFauxServeur();
    render(renderAvecProviders(<OrderCheckoutScreen />));

    await waitFor(() => {
      expect(screen.getByLabelText('Montant reçu')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText('Montant reçu'), '15000');
    fireEvent.press(screen.getByText('ENCAISSER'));

    await waitFor(() => {
      const appelPost = (globalThis.fetch as jest.Mock).mock.calls.find(
        ([, init]: [unknown, RequestInit | undefined]) => init?.method === 'POST',
      );
      expect(appelPost).toBeDefined();
      const corps = JSON.parse(appelPost[1].body as string);
      expect(corps).toMatchObject({ commandeId: 'commande-1', montantRecu: 15000 });
      expect(corps.montant).toBeUndefined();
    });
    expect(mockNavigate).toHaveBeenCalledWith('Ticket', { commandeId: 'commande-1' });
  });

  it('refuse localement un montant reçu insuffisant sans appeler le serveur', async () => {
    installerFauxServeur();
    render(renderAvecProviders(<OrderCheckoutScreen />));

    await waitFor(() => {
      expect(screen.getByLabelText('Montant reçu')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText('Montant reçu'), '3000');
    fireEvent.press(screen.getByText('ENCAISSER'));

    await waitFor(() => {
      expect(screen.getByText('Montant reçu insuffisant : 10000 FCFA dus.')).toBeTruthy();
    });
    expect(
      (globalThis.fetch as jest.Mock).mock.calls.some(
        ([, init]: [unknown, RequestInit | undefined]) => init?.method === 'POST',
      ),
    ).toBe(false);
  });

  it('affiche l’état "déjà encaissée" quand un ENCAISSEMENT existe déjà pour cette commande', async () => {
    installerFauxServeur({
      operationsExistantes: [
        { id: 'op-0', type: 'ENCAISSEMENT', montant: '10000', commandeId: 'commande-1' },
      ],
    });
    render(renderAvecProviders(<OrderCheckoutScreen />));

    await waitFor(() => {
      expect(screen.getByText('Cette commande est déjà encaissée.')).toBeTruthy();
    });
    expect(screen.queryByLabelText('Montant reçu')).toBeNull();
  });
});
