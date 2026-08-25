import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { StocksPage } from './StocksPage';

const ARTICLE_OK = {
  id: 'art-1',
  code: 'HNG-WIR-STD',
  intitule: 'Cintres Fil Métal',
  unite: 'unités',
  seuil: 500,
  icone: 'checkroom',
  actif: true,
  quantite: 1240,
  enAlerte: false,
  createdAt: '2026-08-20T10:00:00Z',
  updatedAt: '2026-08-20T10:00:00Z',
};
const ARTICLE_ALERTE = {
  id: 'art-2',
  code: 'DET-05L-PRO',
  intitule: 'Detergent Pro-Clean',
  unite: 'bidons (5L)',
  seuil: 10,
  icone: 'water_drop',
  actif: true,
  quantite: 2,
  enAlerte: true,
  createdAt: '2026-08-20T10:00:00Z',
  updatedAt: '2026-08-20T10:00:00Z',
};
const NOUVEL_ARTICLE = {
  id: 'art-3',
  code: 'PLY-RL-600',
  intitule: 'Gaines Plastique',
  unite: 'rouleaux',
  seuil: 5,
  actif: true,
  quantite: 0,
  enAlerte: true,
  createdAt: '2026-08-24T10:00:00Z',
  updatedAt: '2026-08-24T10:00:00Z',
};

function installerFauxServeur(articlesInitiaux: unknown[] = [ARTICLE_OK, ARTICLE_ALERTE]) {
  let articles = articlesInitiaux;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/mouvements') && method === 'POST') {
        return Promise.resolve(reponseJson({ id: 'mvt-1' }, 201));
      }
      if (url.includes('/mouvements')) {
        return Promise.resolve(reponseJson([]));
      }
      if (url.includes('/stocks/articles') && method === 'POST') {
        articles = [...articles, NOUVEL_ARTICLE];
        return Promise.resolve(reponseJson(NOUVEL_ARTICLE, 201));
      }
      if (url.includes('/stocks/articles')) {
        return Promise.resolve(reponseJson(articles));
      }
      return Promise.resolve(reponseJson({}));
    }),
  );
}

function connecter(role: 'ADMIN' | 'CAISSIER' | 'TECHNICIEN' = 'ADMIN') {
  localStorage.setItem(
    'fotall.session',
    JSON.stringify({
      accessToken: 'token-123',
      tenant: { id: 't1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
      user: { id: 'u1', email: 'admin@pressing-test.dev', role },
    }),
  );
}

describe('StocksPage', () => {
  beforeEach(() => {
    connecter();
  });

  it('affiche les articles avec leur quantité et signale les articles en alerte', async () => {
    installerFauxServeur();
    const { element } = renderAvecProviders(<StocksPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Cintres Fil Métal')).toBeDefined();
      expect(screen.getByText('Detergent Pro-Clean')).toBeDefined();
    });

    expect(screen.getByText('Stock bas')).toBeDefined();
    expect(screen.getAllByText('EN STOCK').length).toBeGreaterThan(0);
    expect(screen.getAllByText('STOCK BAS').length).toBeGreaterThan(0);
  });

  it('crée un nouvel article via le formulaire (ADMIN)', async () => {
    installerFauxServeur([]);
    const { element } = renderAvecProviders(<StocksPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText("Aucun article pour l'instant.")).toBeDefined();
    });

    fireEvent.click(screen.getByText('Nouvel article'));
    fireEvent.change(screen.getByLabelText('Code (SKU)'), {
      target: { value: 'PLY-RL-600' },
    });
    fireEvent.change(screen.getByLabelText('Intitulé'), {
      target: { value: 'Gaines Plastique' },
    });
    fireEvent.change(screen.getByLabelText('Unité'), { target: { value: 'rouleaux' } });
    fireEvent.click(screen.getByText("Créer l'article"));

    await waitFor(() => {
      expect(screen.getByText('Gaines Plastique')).toBeDefined();
    });
  });

  it('masque "Nouvel article" pour un rôle non-ADMIN', async () => {
    connecter('CAISSIER');
    installerFauxServeur();
    const { element } = renderAvecProviders(<StocksPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Cintres Fil Métal')).toBeDefined();
    });

    expect(screen.queryByText('Nouvel article')).toBeNull();
    expect(screen.queryAllByText('Ajuster').length).toBe(0);
  });

  it('enregistre un mouvement d’entrée pour un article (TECHNICIEN)', async () => {
    connecter('TECHNICIEN');
    installerFauxServeur();
    const { element } = renderAvecProviders(<StocksPage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Cintres Fil Métal')).toBeDefined();
    });

    const boutonsAjuster = screen.getAllByText('Ajuster');
    expect(boutonsAjuster.length).toBeGreaterThan(0);
    fireEvent.click(boutonsAjuster[0] as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText('Confirmer')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Quantité'), { target: { value: '10' } });
    fireEvent.click(screen.getByText('Confirmer'));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/mouvements'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"type":"ENTREE"'),
        }),
      );
    });
  });
});
