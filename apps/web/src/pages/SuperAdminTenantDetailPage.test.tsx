import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { SuperAdminTenantDetailPage } from './SuperAdminTenantDetailPage';

const TENANT = {
  id: 'tenant-1',
  nomPressing: 'Pressing Lumière',
  sousDomaine: 'pressing-lumiere',
  plan: 'PRO' as const,
  langue: 'fr',
  devise: 'XOF',
  fuseauHoraire: 'Africa/Dakar',
  createdAt: '2026-01-01T00:00:00Z',
  proprietaire: 'admin@pressing-lumiere.dev',
  nombreUtilisateurs: 3,
  licence: {
    statut: 'ESSAI' as const,
    dateDebutEssai: '2026-01-01T00:00:00Z',
    dateFinEssai: '2026-01-15T00:00:00Z',
  },
};

const UTILISATEURS = [
  {
    id: 'user-admin-1',
    email: 'admin@pressing-lumiere.dev',
    role: 'ADMIN' as const,
    actif: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'user-caissier-1',
    email: 'caissier@pressing-lumiere.dev',
    role: 'CAISSIER' as const,
    actif: true,
    createdAt: '2026-01-02T00:00:00Z',
  },
];

function monter(
  reponseAbonnement: { status: number; corps: unknown },
  sessionSupportActive = false,
  options: { utilisateurs?: unknown[]; reponsePatchMdp?: { status: number; corps: unknown } } = {},
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/facturation/')) {
        return Promise.resolve(reponseJson(reponseAbonnement.corps, reponseAbonnement.status));
      }
      if (url.includes('/licence/activer') && method === 'POST') {
        return Promise.resolve(reponseJson({ ...TENANT.licence, statut: 'ACTIVE' }, 201));
      }
      if (url.includes('/historique-abonnement')) {
        return Promise.resolve(reponseJson([]));
      }
      if (url.includes('/factures')) {
        return Promise.resolve(reponseJson([]));
      }
      if (url.includes('/mot-de-passe') && method === 'PATCH') {
        const reponse = options.reponsePatchMdp ?? { status: 200, corps: { ok: true } };
        return Promise.resolve(reponseJson(reponse.corps, reponse.status));
      }
      if (url.includes('/utilisateurs')) {
        return Promise.resolve(reponseJson(options.utilisateurs ?? []));
      }
      if (url.includes('/audit') && !url.includes('/support/audit')) {
        return Promise.resolve(reponseJson([]));
      }
      if (url.includes('/support/session')) {
        return Promise.resolve(
          reponseJson(
            sessionSupportActive
              ? {
                  actif: true,
                  session: {
                    id: 'support-1',
                    tenantId: 'tenant-1',
                    superAdminId: 'super-1',
                    motif: 'Diagnostic incident client',
                    startedAt: '2026-08-21T09:00:00Z',
                  },
                }
              : { actif: false, session: null },
          ),
        );
      }
      if (url.includes('/support/demarrer') && method === 'POST') {
        return Promise.resolve(reponseJson({ id: 'support-1' }, 201));
      }
      if (url.includes('/support/audit')) {
        return Promise.resolve(reponseJson([]));
      }
      return Promise.resolve(reponseJson(TENANT));
    }),
  );

  localStorage.setItem(
    'fotall.session',
    JSON.stringify({
      accessToken: 'token-super-123',
      user: { id: 'super-1', email: 'super@fotall.dev', role: 'SUPER_ADMIN' },
    }),
  );

  const { element } = renderAvecProviders(
    <Routes>
      <Route path="/super-admin/tenants/:id" element={<SuperAdminTenantDetailPage />} />
    </Routes>,
    ['/super-admin/tenants/tenant-1'],
  );
  render(element);
}

describe('SuperAdminTenantDetailPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
  });

  it('affiche les informations du tenant sur l’onglet Informations par défaut', async () => {
    monter({ status: 404, corps: { statusCode: 404, message: 'Aucun abonnement.' } });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pressing Lumière' })).toBeDefined();
      expect(screen.getByText('admin@pressing-lumiere.dev')).toBeDefined();
    });
  });

  it('affiche le statut de licence sur l’onglet Licence', async () => {
    monter({ status: 404, corps: { statusCode: 404, message: 'Aucun abonnement.' } });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pressing Lumière' })).toBeDefined();
    });
    fireEvent.click(screen.getByText('Licence'));

    await waitFor(() => {
      expect(screen.getByText('ESSAI')).toBeDefined();
    });
  });

  it('propose la création d’un abonnement quand aucun n’existe (404)', async () => {
    monter({ status: 404, corps: { statusCode: 404, message: 'Aucun abonnement.' } });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pressing Lumière' })).toBeDefined();
    });
    fireEvent.click(screen.getByText('Abonnement'));

    await waitFor(() => {
      expect(screen.getByText('Aucun abonnement pour ce tenant.')).toBeDefined();
    });
  });

  it('affiche l’abonnement existant quand il y en a un', async () => {
    monter({
      status: 200,
      corps: {
        id: 'abo-1',
        tenantId: 'tenant-1',
        plan: 'PRO',
        modePaiement: 'CARTE',
        montant: '15000.00',
        devise: 'XOF',
        statut: 'ACTIF',
        dateProchaineFacturation: '2026-02-01T00:00:00Z',
        journal: [],
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pressing Lumière' })).toBeDefined();
    });
    fireEvent.click(screen.getByText('Abonnement'));

    await waitFor(() => {
      expect(screen.getByText('Plan actuel')).toBeDefined();
      expect(screen.getByText('15 000 XOF / mois')).toBeDefined();
    });
  });

  it('génère une facture depuis l’onglet Factures', async () => {
    monter({
      status: 200,
      corps: {
        id: 'abo-1',
        tenantId: 'tenant-1',
        plan: 'PRO',
        modePaiement: 'CARTE',
        montant: '15000.00',
        devise: 'XOF',
        statut: 'ACTIF',
        dateProchaineFacturation: '2026-02-01T00:00:00Z',
        journal: [],
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pressing Lumière' })).toBeDefined();
    });
    fireEvent.click(screen.getByText('Factures'));

    await waitFor(() => {
      expect(screen.getByText('Créer une facture')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Créer une facture'));

    await waitFor(() => {
      const appelCreation = vi
        .mocked(fetch)
        .mock.calls.some(
          ([input, init]) =>
            String(input).includes('/tenant-1/factures') &&
            (init as RequestInit | undefined)?.method === 'POST',
        );
      expect(appelCreation).toBe(true);
    });
  });

  it('déclenche l’activation de la licence', async () => {
    monter({ status: 404, corps: { statusCode: 404, message: 'Aucun abonnement.' } });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pressing Lumière' })).toBeDefined();
    });
    fireEvent.click(screen.getByText('Licence'));
    await waitFor(() => {
      expect(screen.getByText('Activer')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Activer'));

    await waitFor(() => {
      const appelActiver = vi
        .mocked(fetch)
        .mock.calls.some(([input]) => String(input).includes('/licence/activer'));
      expect(appelActiver).toBe(true);
    });
  });

  it('n’active pas la licence si la confirmation est annulée', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    monter({ status: 404, corps: { statusCode: 404, message: 'Aucun abonnement.' } });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pressing Lumière' })).toBeDefined();
    });
    fireEvent.click(screen.getByText('Licence'));
    await waitFor(() => {
      expect(screen.getByText('Activer')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Activer'));

    await waitFor(() => {
      const appelActiver = vi
        .mocked(fetch)
        .mock.calls.some(([input]) => String(input).includes('/licence/activer'));
      expect(appelActiver).toBe(false);
    });
  });

  it('propose de démarrer une session support quand aucune n’est active', async () => {
    monter({ status: 404, corps: { statusCode: 404, message: 'Aucun abonnement.' } }, false);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pressing Lumière' })).toBeDefined();
    });
    fireEvent.click(screen.getByText('Support'));

    await waitFor(() => {
      expect(screen.getByText('Démarrer la session')).toBeDefined();
    });
  });

  it('affiche la session support active et son journal d’audit', async () => {
    monter({ status: 404, corps: { statusCode: 404, message: 'Aucun abonnement.' } }, true);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pressing Lumière' })).toBeDefined();
    });
    fireEvent.click(screen.getByText('Support'));

    await waitFor(() => {
      expect(screen.getByText(/Session active depuis/)).toBeDefined();
      expect(screen.getByText(/Diagnostic incident client/)).toBeDefined();
      expect(screen.getByText('Terminer la session')).toBeDefined();
    });
  });

  describe('réinitialisation du mot de passe', () => {
    async function ouvrirOngletUtilisateurs(options?: {
      utilisateurs?: unknown[];
      reponsePatchMdp?: { status: number; corps: unknown };
    }) {
      monter(
        { status: 404, corps: { statusCode: 404, message: 'Aucun abonnement.' } },
        false,
        options ?? { utilisateurs: UTILISATEURS },
      );
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Pressing Lumière' })).toBeDefined();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Utilisateurs' }));
      await waitFor(() => {
        expect(screen.getByText('admin@pressing-lumiere.dev')).toBeDefined();
      });
    }

    function boutonReinitialiser(index: 0 | 1): HTMLElement {
      const [admin, caissier] = screen.getAllByText('Réinitialiser le mot de passe');
      const bouton = index === 0 ? admin : caissier;
      if (!bouton) {
        throw new Error('Bouton de réinitialisation introuvable.');
      }
      return bouton;
    }

    it('affiche un bouton de réinitialisation par utilisateur', async () => {
      await ouvrirOngletUtilisateurs();
      expect(screen.getAllByText('Réinitialiser le mot de passe')).toHaveLength(2);
    });

    it('ouvre la modal avec un avertissement spécifique pour le propriétaire (ADMIN)', async () => {
      await ouvrirOngletUtilisateurs();
      fireEvent.click(boutonReinitialiser(0));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeDefined();
        expect(screen.getByText(/propriétaire/)).toBeDefined();
      });
    });

    it('n’affiche pas l’avertissement propriétaire pour un rôle non-ADMIN', async () => {
      await ouvrirOngletUtilisateurs();
      fireEvent.click(boutonReinitialiser(1));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeDefined();
      });
      expect(screen.queryByText(/propriétaire/)).toBeNull();
    });

    it('refuse la soumission si la confirmation ne correspond pas au mot de passe', async () => {
      await ouvrirOngletUtilisateurs();
      fireEvent.click(boutonReinitialiser(0));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());

      fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), {
        target: { value: 'nouveau-secret-1' },
      });
      fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
        target: { value: 'autre-chose' },
      });
      fireEvent.click(screen.getByText('Réinitialiser'));

      await waitFor(() => {
        expect(screen.getByText('La confirmation ne correspond pas.')).toBeDefined();
      });
      const appelPatch = vi
        .mocked(fetch)
        .mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH');
      expect(appelPatch).toBe(false);
    });

    it('affiche l’erreur renvoyée par l’API', async () => {
      await ouvrirOngletUtilisateurs({
        utilisateurs: UTILISATEURS,
        reponsePatchMdp: {
          status: 400,
          corps: { statusCode: 400, message: 'Mot de passe trop faible.' },
        },
      });
      fireEvent.click(boutonReinitialiser(0));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());

      fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), {
        target: { value: 'court123' },
      });
      fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
        target: { value: 'court123' },
      });
      fireEvent.click(screen.getByText('Réinitialiser'));

      await waitFor(() => {
        expect(screen.getByText('Mot de passe trop faible.')).toBeDefined();
      });
    });

    it('affiche un état de chargement pendant la soumission', async () => {
      await ouvrirOngletUtilisateurs();
      fireEvent.click(boutonReinitialiser(0));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());

      fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), {
        target: { value: 'nouveau-secret-1' },
      });
      fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
        target: { value: 'nouveau-secret-1' },
      });
      fireEvent.click(screen.getByText('Réinitialiser'));

      await waitFor(() => {
        expect(screen.getByText('Réinitialisation…')).toBeDefined();
      });
    });

    it('affiche le message de succès et ferme la modal', async () => {
      await ouvrirOngletUtilisateurs();
      fireEvent.click(boutonReinitialiser(0));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());

      fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), {
        target: { value: 'nouveau-secret-1' },
      });
      fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
        target: { value: 'nouveau-secret-1' },
      });
      fireEvent.click(screen.getByText('Réinitialiser'));

      await waitFor(() => {
        expect(screen.getByText('Le mot de passe a été réinitialisé.')).toBeDefined();
        expect(
          screen.getByText(
            "L'utilisateur devra définir un nouveau mot de passe à sa prochaine connexion.",
          ),
        ).toBeDefined();
      });

      fireEvent.click(screen.getByText('Fermer'));
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
    });

    it('ferme la modal sur Annuler sans appeler l’API', async () => {
      await ouvrirOngletUtilisateurs();
      fireEvent.click(boutonReinitialiser(0));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());

      fireEvent.click(screen.getByText('Annuler'));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
      const appelPatch = vi
        .mocked(fetch)
        .mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH');
      expect(appelPatch).toBe(false);
    });
  });
});
