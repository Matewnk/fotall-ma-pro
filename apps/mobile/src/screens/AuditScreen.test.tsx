import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, waitFor } from '@testing-library/react-native';
import { renderAvecProviders, reponseJson } from '../test-utils';
import { AuditScreen } from './AuditScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const SESSION = {
  accessToken: 'token-123',
  tenant: { id: 'tenant-1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
  user: { id: 'user-1', email: 'admin@pressing-test.dev', role: 'ADMIN' as const },
};

const ENTREES = [
  {
    id: 'audit-1',
    action: 'TENANT_PLAN_MODIFIE',
    entityType: 'Tenant',
    entityId: 'tenant-1',
    actorId: 'user-1',
    createdAt: '2026-08-01T10:00:00Z',
  },
];

function installerFauxServeur() {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/audit')) {
      return Promise.resolve(reponseJson(ENTREES));
    }
    return Promise.resolve(reponseJson({}));
  }) as jest.Mock;
}

describe('AuditScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem('fotall.session', JSON.stringify(SESSION));
  });

  it("affiche les entrées du journal d'audit", async () => {
    installerFauxServeur();
    render(renderAvecProviders(<AuditScreen />));

    await waitFor(
      () => {
        expect(screen.getByText('TENANT_PLAN_MODIFIE')).toBeTruthy();
      },
      { timeout: 10000 },
    );
  });
});
