import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderAvecProviders } from '../test-utils';
import { AppShell } from './AppShell';

function connecterSession(role: 'ADMIN' | 'CAISSIER') {
  localStorage.setItem(
    'fotall.session',
    JSON.stringify({
      accessToken: 'token-123',
      tenant: { id: 't1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
      user: { id: 'u1', email: 'u@pressing-test.dev', role },
    }),
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('affiche le lien Utilisateurs pour un ADMIN', () => {
    connecterSession('ADMIN');
    const { element } = renderAvecProviders(
      <AppShell>
        <div />
      </AppShell>,
    );
    render(element);

    expect(screen.getByText('Utilisateurs')).toBeDefined();
  });

  it('masque le lien Utilisateurs pour un CAISSIER (RBAC réel côté API, ceci n’est qu’un affichage)', () => {
    connecterSession('CAISSIER');
    const { element } = renderAvecProviders(
      <AppShell>
        <div />
      </AppShell>,
    );
    render(element);

    expect(screen.queryByText('Utilisateurs')).toBeNull();
  });
});
