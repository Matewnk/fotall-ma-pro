import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { renderAvecProviders } from './test-utils';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redirige vers /connexion quand aucune session n’est présente', () => {
    const { element } = renderAvecProviders(<App />, ['/']);
    render(element);
    expect(screen.getByText('Fotall-Ma Pro')).toBeDefined();
    expect(screen.getByText('Se connecter')).toBeDefined();
  });

  it('affiche le formulaire d’inscription sur /inscription', () => {
    const { element } = renderAvecProviders(<App />, ['/inscription']);
    render(element);
    expect(screen.getByText('Créer mon compte')).toBeDefined();
  });
});
