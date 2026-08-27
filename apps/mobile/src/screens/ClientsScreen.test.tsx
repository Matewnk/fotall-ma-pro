import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { renderAvecProviders, reponseJson } from '../test-utils';
import { ClientsScreen } from './ClientsScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const SESSION = {
  accessToken: 'token-123',
  tenant: { id: 'tenant-1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
  user: { id: 'user-1', email: 'admin@pressing-test.dev', role: 'ADMIN' as const },
};

const CLIENTS = [
  { id: 'client-1', nom: 'Fatou Sy', telephone: '+221701112233', statut: 'ACTIF' as const },
];
const NOUVEAU_CLIENT = {
  id: 'client-2',
  nom: 'Awa Diop',
  telephone: '+221709998877',
  statut: 'ACTIF' as const,
};

function installerFauxServeur(clientsInitiaux: unknown[] = CLIENTS) {
  let clients = clientsInitiaux;
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.includes('/clients') && method === 'POST') {
      clients = [...clients, NOUVEAU_CLIENT];
      return Promise.resolve(reponseJson(NOUVEAU_CLIENT, true, 201));
    }
    if (url.includes('/clients') && method === 'DELETE') {
      clients = clients.filter((c) => (c as { id: string }).id !== 'client-1');
      return Promise.resolve(reponseJson({}));
    }
    return Promise.resolve(reponseJson(clients));
  }) as jest.Mock;
}

describe('ClientsScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem('fotall.session', JSON.stringify(SESSION));
  });

  it('affiche la liste des clients existants', async () => {
    installerFauxServeur();
    render(renderAvecProviders(<ClientsScreen />));

    await waitFor(
      () => {
        expect(screen.getByText('Fatou Sy')).toBeTruthy();
      },
      { timeout: 10000 },
    );
  });

  it('crée un nouveau client via le formulaire', async () => {
    installerFauxServeur([]);
    render(renderAvecProviders(<ClientsScreen />));

    await waitFor(
      () => {
        expect(screen.getByText("Aucun client pour l'instant.")).toBeTruthy();
      },
      { timeout: 10000 },
    );

    fireEvent.press(screen.getByText('Nouveau client'));
    fireEvent.changeText(screen.getByLabelText('Nom'), 'Awa Diop');
    fireEvent.changeText(screen.getByLabelText('Téléphone'), '+221709998877');
    fireEvent.press(screen.getByText('Créer le client'));

    await waitFor(
      () => {
        expect(screen.getByText('Awa Diop')).toBeTruthy();
      },
      { timeout: 10000 },
    );
  });
});
