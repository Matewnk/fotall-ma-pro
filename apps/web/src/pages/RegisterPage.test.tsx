import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { RegisterPage } from './RegisterPage';

const SESSION = {
  accessToken: 'token-123',
  tenant: { id: 'tenant-1', nomPressing: 'Pressing Test', sousDomaine: 'pressing-test' },
  user: { id: 'user-1', email: 'admin@test.dev', role: 'ADMIN' as const, mustChangePassword: false },
};

function remplirFormulaireValide() {
  fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Awa' } });
  fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Diop' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'awa@test.dev' } });
  fireEvent.change(screen.getByLabelText('Mot de passe'), {
    target: { value: 'super-secret-1' },
  });
  fireEvent.change(screen.getByLabelText('Nom du pressing'), {
    target: { value: 'Pressing Awa' },
  });
  fireEvent.change(screen.getByLabelText('Sous-domaine'), {
    target: { value: 'pressing-awa' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
}

describe('RegisterPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('affiche la page avec titre et positionnement commercial', () => {
    const { element } = renderAvecProviders(<RegisterPage />);
    render(element);

    expect(screen.getByText('Créez votre compte')).toBeDefined();
    expect(
      screen.getByText(/Gestion professionnelle de votre pressing/),
    ).toBeDefined();
  });

  it('affiche le bouton Google', () => {
    const { element } = renderAvecProviders(<RegisterPage />);
    render(element);

    expect(screen.getByText("S'inscrire avec Google")).toBeDefined();
  });

  it('affiche tous les champs du formulaire classique', () => {
    const { element } = renderAvecProviders(<RegisterPage />);
    render(element);

    expect(screen.getByLabelText('Prénom')).toBeDefined();
    expect(screen.getByLabelText('Nom')).toBeDefined();
    expect(screen.getByLabelText('Email')).toBeDefined();
    expect(screen.getByLabelText('Mot de passe')).toBeDefined();
    expect(screen.getByLabelText('Nom du pressing')).toBeDefined();
    expect(screen.getByLabelText('Sous-domaine')).toBeDefined();
    expect(screen.getByLabelText('Pays')).toBeDefined();
  });

  it('le bouton de soumission reste désactivé tant que le formulaire est incomplet', () => {
    const { element } = renderAvecProviders(<RegisterPage />);
    render(element);

    expect(screen.getByText('Créer mon compte')).toHaveProperty('disabled', true);
  });

  it("affiche 'Ce champ est obligatoire.' pour les champs requis manquants après tentative de soumission", () => {
    const { element } = renderAvecProviders(<RegisterPage />);
    render(element);

    // Remplit tout sauf prenom, coche les conditions, pour forcer le bouton
    // à s'activer une fois les autres champs valides puis vide prenom.
    remplirFormulaireValide();
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: '' } });
    fireEvent.blur(screen.getByLabelText('Prénom'));

    expect(screen.getAllByText('Ce champ est obligatoire.').length).toBeGreaterThan(0);
  });

  it('valide la longueur minimale du mot de passe (10 caractères)', () => {
    const { element } = renderAvecProviders(<RegisterPage />);
    render(element);

    remplirFormulaireValide();
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'court1' } });
    fireEvent.blur(screen.getByLabelText('Mot de passe'));

    expect(
      screen.getByText('Le mot de passe doit contenir au moins 10 caractères.'),
    ).toBeDefined();
  });

  it("exige l'acceptation des conditions", () => {
    const { element } = renderAvecProviders(<RegisterPage />);
    render(element);

    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Awa' } });
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Diop' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'awa@test.dev' } });
    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: 'super-secret-1' },
    });
    fireEvent.change(screen.getByLabelText('Nom du pressing'), {
      target: { value: 'Pressing Awa' },
    });
    fireEvent.change(screen.getByLabelText('Sous-domaine'), {
      target: { value: 'pressing-awa' },
    });
    // Conditions non cochées : le bouton doit rester désactivé.
    expect(screen.getByText('Créer mon compte')).toHaveProperty('disabled', true);
  });

  it('soumet le formulaire classique et enregistre la session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        expect(String(input)).toContain('/auth/register');
        return Promise.resolve(reponseJson(SESSION));
      }),
    );

    const { element } = renderAvecProviders(<RegisterPage />);
    render(element);

    remplirFormulaireValide();
    fireEvent.click(screen.getByText('Créer mon compte'));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('fotall.session') ?? 'null')).toEqual(SESSION);
    });
  });

  it('affiche le message serveur exact en cas de conflit (email/sous-domaine déjà utilisé)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          reponseJson({ statusCode: 409, message: 'Cette adresse e-mail est déjà utilisée.' }, 409),
        ),
      ),
    );

    const { element } = renderAvecProviders(<RegisterPage />);
    render(element);

    remplirFormulaireValide();
    fireEvent.click(screen.getByText('Créer mon compte'));

    await waitFor(() => {
      expect(screen.getByText('Cette adresse e-mail est déjà utilisée.')).toBeDefined();
    });
  });

  it("affiche l'état de chargement pendant la soumission", async () => {
    let resoudre: (() => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resoudre = () => resolve(reponseJson(SESSION));
          }),
      ),
    );

    const { element } = renderAvecProviders(<RegisterPage />);
    render(element);

    remplirFormulaireValide();
    fireEvent.click(screen.getByText('Créer mon compte'));

    await waitFor(() => {
      expect(screen.getByText('Création…')).toBeDefined();
    });

    resoudre?.();
    await waitFor(() => {
      expect(localStorage.getItem('fotall.session')).not.toBeNull();
    });
  });

  it('affiche un message générique sur erreur serveur (500)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(reponseJson({ statusCode: 500, message: 'Internal server error' }, 500)),
      ),
    );

    const { element } = renderAvecProviders(<RegisterPage />);
    render(element);

    remplirFormulaireValide();
    fireEvent.click(screen.getByText('Créer mon compte'));

    await waitFor(() => {
      expect(screen.getByText('Une erreur est survenue. Veuillez réessayer.')).toBeDefined();
    });
  });

  it('redirige vers /auth/google au clic sur le bouton Google', () => {
    const original = window.location;
    // @ts-expect-error remplacement contrôlé pour le test
    delete window.location;
    // @ts-expect-error redéfinition minimale pour capter l'affectation href
    window.location = { href: '' };

    const { element } = renderAvecProviders(<RegisterPage />);
    render(element);

    fireEvent.click(screen.getByText("S'inscrire avec Google"));

    expect(window.location.href).toContain('/auth/google');
    // @ts-expect-error restauration de l'objet Location d'origine
    window.location = original;
  });

  it('propose un lien vers la page de connexion', () => {
    const { element } = renderAvecProviders(<RegisterPage />);
    render(element);

    expect(screen.getByText('Se connecter').getAttribute('href')).toBe('/connexion');
  });
});
