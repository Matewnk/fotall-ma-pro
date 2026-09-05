import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson, renderAvecProviders } from '../test-utils';
import { BillingSelfServicePage } from './BillingSelfServicePage';

function dansNJours(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}

const ABONNEMENT_ACTIF = {
  id: 'abo-1',
  tenantId: 'tenant-1',
  plan: 'PRO' as const,
  modePaiement: 'CARTE' as const,
  montant: '35000.00',
  devise: 'XOF',
  statut: 'ACTIF' as const,
  dateProchaineFacturation: dansNJours(60),
  journal: [
    {
      id: 'jp-1',
      type: 'PAIEMENT_REUSSI',
      montant: '35000.00',
      devise: 'XOF',
      referenceProvider: 'PAY-2026-00125',
      createdAt: '2026-08-01T00:00:00Z',
    },
    {
      id: 'jp-2',
      type: 'PAIEMENT_ECHEC',
      montant: '35000.00',
      devise: 'XOF',
      createdAt: '2026-07-01T00:00:00Z',
    },
  ],
  licence: {
    statut: 'ACTIVE' as const,
    dateActivation: '2026-01-01T00:00:00Z',
    dateExpirationCourante: dansNJours(60),
  },
  paiementEnLigneDisponible: true,
};

const ABONNEMENT_PROCHE = {
  ...ABONNEMENT_ACTIF,
  dateProchaineFacturation: dansNJours(5),
  licence: { ...ABONNEMENT_ACTIF.licence, dateExpirationCourante: dansNJours(5) },
};

const ABONNEMENT_EXPIRE = {
  ...ABONNEMENT_ACTIF,
  licence: {
    statut: 'EXPIREE' as const,
    dateActivation: '2026-01-01T00:00:00Z',
    dateExpirationCourante: dansNJours(-3),
  },
};

const ABONNEMENT_ANNULE = {
  ...ABONNEMENT_ACTIF,
  statut: 'ANNULE' as const,
};

const FACTURES = [
  {
    id: 'fac-1',
    numero: 'FAC-2026-0001',
    tenantId: 'tenant-1',
    planSnap: 'PRO' as const,
    montant: 35000,
    devise: 'XOF',
    modePaiementSnap: 'CARTE' as const,
    periodeDebut: '2026-08-01T00:00:00Z',
    periodeFin: '2026-09-01T00:00:00Z',
    statut: 'PAYEE' as const,
    dateEmission: '2026-08-01T00:00:00Z',
    dateEcheance: '2026-09-01T00:00:00Z',
    paiementRefId: 'jp-1',
    emisePar: 'super-1',
  },
  {
    id: 'fac-2',
    numero: 'FAC-2026-0002',
    tenantId: 'tenant-1',
    planSnap: 'PRO' as const,
    montant: 35000,
    devise: 'XOF',
    modePaiementSnap: 'CARTE' as const,
    periodeDebut: '2026-07-01T00:00:00Z',
    periodeFin: '2026-08-01T00:00:00Z',
    statut: 'EN_RETARD' as const,
    dateEmission: '2026-07-01T00:00:00Z',
    dateEcheance: '2026-08-01T00:00:00Z',
    paiementRefId: null,
    emisePar: 'super-1',
  },
  {
    id: 'fac-3',
    numero: 'FAC-2026-0003',
    tenantId: 'tenant-1',
    planSnap: 'PRO' as const,
    montant: 35000,
    devise: 'XOF',
    modePaiementSnap: 'CARTE' as const,
    periodeDebut: dansNJours(0),
    periodeFin: dansNJours(30),
    statut: 'EMISE' as const,
    dateEmission: dansNJours(0),
    dateEcheance: dansNJours(30),
    paiementRefId: null,
    emisePar: 'super-1',
  },
];

const PLANS = [
  {
    plan: 'STARTER',
    prixMensuel: 15000,
    devise: 'XOF',
    limiteUtilisateurs: 3,
    limitePointsDeService: 1,
    fonctionnalites: [],
  },
  {
    plan: 'PRO',
    prixMensuel: 35000,
    devise: 'XOF',
    limiteUtilisateurs: 10,
    limitePointsDeService: 3,
    fonctionnalites: ['Caisse'],
  },
  {
    plan: 'BUSINESS',
    prixMensuel: null,
    devise: 'XOF',
    limiteUtilisateurs: null,
    limitePointsDeService: null,
    fonctionnalites: [],
  },
];

type StubOptions = {
  abonnement?: { status: number; corps: unknown };
  factures?: { status: number; corps: unknown };
  renouvellement?: { status: number; corps: unknown };
  confirmation?: { status: number; corps: unknown };
  demandeBusiness?: { status: number; corps: unknown };
};

function stubFetch(options: StubOptions = {}) {
  const abonnement = options.abonnement ?? { status: 200, corps: ABONNEMENT_ACTIF };
  const factures = options.factures ?? { status: 200, corps: FACTURES };

  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url.includes('/demandes-business') && method === 'POST') {
      const reponse = options.demandeBusiness ?? {
        status: 201,
        corps: { id: 'demande-1', statut: 'NOUVEAU' },
      };
      return Promise.resolve(reponseJson(reponse.corps, reponse.status));
    }
    if (url.includes('/confirmer-dry-run')) {
      const reponse = options.confirmation ?? {
        status: 201,
        corps: { mode: 'DRY_RUN', facture: { ...FACTURES[2], statut: 'PAYEE' } },
      };
      return Promise.resolve(reponseJson(reponse.corps, reponse.status));
    }
    if (url.includes('/abonnement/renouvellement') && method === 'POST') {
      const reponse = options.renouvellement ?? {
        status: 201,
        corps: {
          factureId: 'fac-3',
          token: 'tok-123',
          redirectUrl: 'https://paytech.sn/dry-run/tok-123',
          mode: 'DRY_RUN',
          plan: 'PRO',
          montant: 35000,
          devise: 'XOF',
          dureeMois: 1,
          dateExpirationActuelle: dansNJours(0),
          nouvelleDateExpiration: dansNJours(30),
        },
      };
      return Promise.resolve(reponseJson(reponse.corps, reponse.status));
    }
    if (url.includes('/abonnement')) {
      return Promise.resolve(reponseJson(abonnement.corps, abonnement.status));
    }
    if (url.includes('/factures')) {
      return Promise.resolve(reponseJson(factures.corps, factures.status));
    }
    if (url.includes('/plans')) {
      return Promise.resolve(reponseJson(PLANS));
    }
    return Promise.resolve(reponseJson({}));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('BillingSelfServicePage', () => {
  beforeEach(() => {
    localStorage.setItem(
      'fotall.session',
      JSON.stringify({
        accessToken: 'token-admin-123',
        tenant: { id: 'tenant-1', nomPressing: 'Pressing Lumière', sousDomaine: 'lumiere' },
        user: { id: 'user-1', email: 'admin@pressing-lumiere.dev', role: 'ADMIN' },
      }),
    );
  });

  it('affiche l’état loading pendant le chargement', () => {
    stubFetch();
    const { element } = renderAvecProviders(<BillingSelfServicePage />);
    render(element);

    expect(screen.getAllByText('Chargement…').length).toBeGreaterThan(0);
  });

  it('affiche un état vide clair quand aucun abonnement n’existe (404)', async () => {
    stubFetch({ abonnement: { status: 404, corps: { statusCode: 404, message: 'Aucun.' } } });
    const { element } = renderAvecProviders(<BillingSelfServicePage />);
    render(element);

    await waitFor(() => {
      expect(
        screen.getByText(/Aucun abonnement n'est encore associé à votre pressing/),
      ).toBeDefined();
    });
  });

  it('affiche un état d’erreur clair (500) distinct de l’état vide (404)', async () => {
    stubFetch({ abonnement: { status: 500, corps: { statusCode: 500, message: 'Panne.' } } });
    const { element } = renderAvecProviders(<BillingSelfServicePage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Panne.')).toBeDefined();
    });
    expect(screen.queryByText(/Aucun abonnement n'est encore associé/)).toBeNull();
  });

  it('abonnement actif loin de l’expiration : badge Actif, jours restants, bouton "Renouveler mon abonnement"', async () => {
    stubFetch();
    const { element } = renderAvecProviders(<BillingSelfServicePage />);
    render(element);

    await waitFor(() => {
      expect(document.body.textContent).toContain('Plan Pro');
      expect(screen.getByText(/🟢 Actif/)).toBeDefined();
      expect(screen.getByText(/Renouveler mon abonnement/)).toBeDefined();
    });
    expect(screen.queryByText(/expire dans/)).toBeNull();
  });

  it('paiementEnLigneDisponible=false : aucun bouton de renouvellement, message d’indisponibilité', async () => {
    stubFetch({
      abonnement: {
        status: 200,
        corps: { ...ABONNEMENT_ACTIF, paiementEnLigneDisponible: false },
      },
    });
    const { element } = renderAvecProviders(<BillingSelfServicePage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText(/Renouvellement en ligne bientôt disponible/)).toBeDefined();
    });
    expect(screen.queryByText(/Renouveler mon abonnement/)).toBeNull();
  });

  it('abonnement proche de l’expiration : alerte et bouton "Renouveler maintenant"', async () => {
    stubFetch({ abonnement: { status: 200, corps: ABONNEMENT_PROCHE } });
    const { element } = renderAvecProviders(<BillingSelfServicePage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText(/Votre abonnement expire dans \d+ jours\./)).toBeDefined();
      expect(screen.getByText(/Renouveler maintenant/)).toBeDefined();
    });
  });

  it('abonnement expiré (Licence EXPIREE) : badge Expiré et bouton "Réactiver mon abonnement"', async () => {
    stubFetch({ abonnement: { status: 200, corps: ABONNEMENT_EXPIRE } });
    const { element } = renderAvecProviders(<BillingSelfServicePage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText(/🔴 Expiré/)).toBeDefined();
      expect(screen.getByText('Votre abonnement est expiré.')).toBeDefined();
      expect(screen.getByText(/Réactiver mon abonnement/)).toBeDefined();
    });
  });

  it('abonnement annulé : badge Annulé, aucun bouton de renouvellement, "aucun paiement programmé"', async () => {
    stubFetch({ abonnement: { status: 200, corps: ABONNEMENT_ANNULE } });
    const { element } = renderAvecProviders(<BillingSelfServicePage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText(/⚫ Annulé/)).toBeDefined();
      expect(screen.getByText("Votre abonnement n'a aucun paiement programmé.")).toBeDefined();
    });
    expect(screen.queryByText('Renouveler mon abonnement')).toBeNull();
  });

  it('ouvre la modal, permet de choisir une durée et affiche le calcul en direct', async () => {
    stubFetch();
    const { element } = renderAvecProviders(<BillingSelfServicePage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText(/Renouveler mon abonnement/)).toBeDefined();
    });
    fireEvent.click(screen.getByText(/Renouveler mon abonnement/));

    const dialogue = await screen.findByRole('dialog');
    expect(within(dialogue).getByText('Choisissez votre durée')).toBeDefined();
    expect(within(dialogue).getByRole('button', { name: '1 mois' })).toBeDefined();

    // Prix par défaut (1 mois) = 35 000 XOF
    expect(within(dialogue).getByText(/35\s?000 XOF/)).toBeDefined();

    fireEvent.click(within(dialogue).getByRole('button', { name: '12 mois' }));
    await waitFor(() => {
      expect(within(dialogue).getByText(/420\s?000 XOF/)).toBeDefined();
    });
  });

  it('flux complet DRY_RUN : initiation puis confirmation automatique, écran de succès', async () => {
    stubFetch();
    const { element } = renderAvecProviders(<BillingSelfServicePage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText(/Renouveler mon abonnement/)).toBeDefined();
    });
    fireEvent.click(screen.getByText(/Renouveler mon abonnement/));
    const dialogue = await screen.findByRole('dialog');
    fireEvent.click(within(dialogue).getByText('Continuer vers le paiement'));

    await waitFor(() => {
      expect(within(dialogue).getByText(/Mode TEST/)).toBeDefined();
    });

    await waitFor(() => {
      expect(
        within(dialogue).getByText('Votre abonnement a été renouvelé avec succès.'),
      ).toBeDefined();
    });
    expect(within(dialogue).getByText('Voir ma facture')).toBeDefined();
    expect(within(dialogue).getByText('Retour à mon abonnement')).toBeDefined();
  });

  it('affiche une erreur claire si l’initiation du paiement échoue', async () => {
    stubFetch({
      renouvellement: {
        status: 500,
        corps: { statusCode: 500, message: 'Paiement indisponible.' },
      },
    });
    const { element } = renderAvecProviders(<BillingSelfServicePage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText(/Renouveler mon abonnement/)).toBeDefined();
    });
    fireEvent.click(screen.getByText(/Renouveler mon abonnement/));
    const dialogue = await screen.findByRole('dialog');
    fireEvent.click(within(dialogue).getByText('Continuer vers le paiement'));

    await waitFor(() => {
      expect(within(dialogue).getByText('Paiement indisponible.')).toBeDefined();
    });
  });

  it('affiche les factures et filtre Payées / Impayées / En attente', async () => {
    stubFetch();
    const { element } = renderAvecProviders(<BillingSelfServicePage />);
    render(element);

    function tbodyFactures() {
      const section = screen.getByText('Mes factures').closest('section');
      return section?.querySelector('tbody') as HTMLElement;
    }

    await waitFor(() => {
      expect(within(tbodyFactures()).getByText('FAC-2026-0001')).toBeDefined();
      expect(within(tbodyFactures()).getByText('FAC-2026-0002')).toBeDefined();
      expect(within(tbodyFactures()).getByText('FAC-2026-0003')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Payées'));
    await waitFor(() => {
      expect(within(tbodyFactures()).getByText('FAC-2026-0001')).toBeDefined();
      expect(within(tbodyFactures()).queryByText('FAC-2026-0002')).toBeNull();
      expect(within(tbodyFactures()).queryByText('FAC-2026-0003')).toBeNull();
    });

    fireEvent.click(screen.getByText('Impayées'));
    await waitFor(() => {
      expect(within(tbodyFactures()).getByText('FAC-2026-0002')).toBeDefined();
      expect(within(tbodyFactures()).queryByText('FAC-2026-0001')).toBeNull();
    });

    fireEvent.click(screen.getByText('En attente'));
    await waitFor(() => {
      expect(within(tbodyFactures()).getByText('FAC-2026-0003')).toBeDefined();
      expect(within(tbodyFactures()).queryByText('FAC-2026-0002')).toBeNull();
    });
  });

  it('affiche un état vide sur "Mes factures" quand la liste est vide', async () => {
    stubFetch({ factures: { status: 200, corps: [] } });
    const { element } = renderAvecProviders(<BillingSelfServicePage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText("Aucune facture pour l'instant.")).toBeDefined();
    });
  });

  it('historique des paiements : affiche référence, facture associée, et filtre payés/impayés', async () => {
    stubFetch();
    const { element } = renderAvecProviders(<BillingSelfServicePage />);
    render(element);

    await waitFor(() => {
      expect(screen.getByText('Historique des paiements')).toBeDefined();
      expect(screen.getByText('PAY-2026-00125')).toBeDefined();
      // jp-1 est référencé par fac-1 (paiementRefId) :
      const section = screen.getByText('Historique des paiements').closest('section');
      expect(within(section as HTMLElement).getByText('FAC-2026-0001')).toBeDefined();
    });

    const boutonsPayes = screen.getAllByText('Payés');
    fireEvent.click(boutonsPayes[0] as HTMLElement);

    await waitFor(() => {
      const section = screen.getByText('Historique des paiements').closest('section');
      const tbody = section?.querySelector('tbody');
      expect(tbody?.textContent).toContain('Payé');
      expect(tbody?.textContent).not.toContain('Impayé');
    });
  });

  describe('carte Business — formulaire "Nous contacter"', () => {
    async function ouvrirModalContact() {
      stubFetch();
      const { element } = renderAvecProviders(<BillingSelfServicePage />);
      render(element);

      await waitFor(() => {
        expect(screen.getByText('Business')).toBeDefined();
      });
      fireEvent.click(screen.getByText('Nous contacter'));
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeDefined();
      });
    }

    function remplirChamps(surcharge: Partial<Record<string, string>> = {}) {
      const valeurs = {
        nomComplet: 'Jean Dupont',
        entreprise: 'Pressing Lumière',
        email: 'jean.dupont@example.dev',
        telephone: '+221 77 000 00 00',
        message: 'Nous avons plusieurs sites à équiper de votre solution.',
        ...surcharge,
      };
      fireEvent.change(screen.getByLabelText(/Nom complet/), {
        target: { value: valeurs.nomComplet },
      });
      fireEvent.change(screen.getByLabelText(/entreprise \/ pressing/), {
        target: { value: valeurs.entreprise },
      });
      fireEvent.change(screen.getByLabelText(/Adresse email/), {
        target: { value: valeurs.email },
      });
      fireEvent.change(screen.getByLabelText(/Téléphone \/ WhatsApp/), {
        target: { value: valeurs.telephone },
      });
      fireEvent.change(screen.getByLabelText(/Type d'activité/), {
        target: { value: 'PRESSING_BLANCHISSERIE' },
      });
      fireEvent.change(screen.getByLabelText(/Comment pouvons-nous vous aider/), {
        target: { value: 'DEVIS' },
      });
      fireEvent.change(screen.getByLabelText(/Décrivez votre besoin/), {
        target: { value: valeurs.message },
      });
    }

    it('la carte Business est affichée avec son contenu et son bouton', async () => {
      stubFetch();
      const { element } = renderAvecProviders(<BillingSelfServicePage />);
      render(element);

      await waitFor(() => {
        expect(screen.getByText('Business')).toBeDefined();
        expect(screen.getByText('Pour les grands réseaux.')).toBeDefined();
        expect(screen.getByText('Sur mesure')).toBeDefined();
        expect(screen.getByText('Nous contacter')).toBeDefined();
      });
    });

    it('un clic sur "Nous contacter" ouvre la modale avec le formulaire', async () => {
      await ouvrirModalContact();
      expect(screen.getByText('Parlons de votre projet')).toBeDefined();
      expect(screen.getByLabelText(/Nom complet/)).toBeDefined();
    });

    it('affiche les erreurs de validation quand les champs obligatoires sont vides', async () => {
      await ouvrirModalContact();
      fireEvent.click(screen.getByText('Envoyer ma demande'));

      await waitFor(() => {
        expect(screen.getByText('Le nom est obligatoire.')).toBeDefined();
        expect(screen.getByText("L'adresse email est obligatoire.")).toBeDefined();
        expect(screen.getByText('Le numéro de téléphone est obligatoire.')).toBeDefined();
        expect(screen.getByText('Veuillez sélectionner votre activité.')).toBeDefined();
        expect(screen.getByText('Veuillez préciser votre demande.')).toBeDefined();
        expect(screen.getByText('Veuillez décrire votre besoin.')).toBeDefined();
      });
      expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(
        expect.stringContaining('/demandes-business'),
        expect.anything(),
      );
    });

    it('rejette un email invalide', async () => {
      await ouvrirModalContact();
      remplirChamps({ email: 'pas-un-email' });
      fireEvent.click(screen.getByText('Envoyer ma demande'));

      await waitFor(() => {
        expect(screen.getByText('Veuillez saisir une adresse email valide.')).toBeDefined();
      });
    });

    it('soumission valide → appelle POST /demandes-business puis affiche la confirmation', async () => {
      const fetchMock = stubFetch();
      const { element } = renderAvecProviders(<BillingSelfServicePage />);
      render(element);

      await waitFor(() => expect(screen.getByText('Business')).toBeDefined());
      fireEvent.click(screen.getByText('Nous contacter'));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());

      remplirChamps();
      fireEvent.click(screen.getByText('Envoyer ma demande'));

      await waitFor(() => {
        expect(screen.getByText('Demande envoyée !')).toBeDefined();
        expect(
          screen.getByText(/Merci pour votre demande\. Notre équipe vous contactera/),
        ).toBeDefined();
      });

      const appelEnvoi = fetchMock.mock.calls.find(
        ([input, init]) =>
          String(input).includes('/demandes-business') &&
          (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(appelEnvoi).toBeDefined();
      const corps = JSON.parse((appelEnvoi?.[1] as RequestInit).body as string);
      expect(corps).toMatchObject({
        nomComplet: 'Jean Dupont',
        entreprise: 'Pressing Lumière',
        typeActivite: 'PRESSING_BLANCHISSERIE',
        typeDemande: 'DEVIS',
        tenantId: 'tenant-1',
      });
    });

    it('affiche un état de chargement pendant l’envoi', async () => {
      stubFetch({
        demandeBusiness: { status: 201, corps: { id: 'd1', statut: 'NOUVEAU' } },
      });
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          if (url.includes('/demandes-business') && (init?.method ?? 'GET') === 'POST') {
            return new Promise((resolve) => {
              setTimeout(() => resolve(reponseJson({ id: 'd1', statut: 'NOUVEAU' }, 201)), 50);
            });
          }
          if (url.includes('/abonnement')) return Promise.resolve(reponseJson(ABONNEMENT_ACTIF));
          if (url.includes('/factures')) return Promise.resolve(reponseJson(FACTURES));
          if (url.includes('/plans')) return Promise.resolve(reponseJson(PLANS));
          return Promise.resolve(reponseJson({}));
        }),
      );
      const { element } = renderAvecProviders(<BillingSelfServicePage />);
      render(element);

      await waitFor(() => expect(screen.getByText('Business')).toBeDefined());
      fireEvent.click(screen.getByText('Nous contacter'));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());
      remplirChamps();
      fireEvent.click(screen.getByText('Envoyer ma demande'));

      await waitFor(() => {
        expect(screen.getByText('Envoi en cours…')).toBeDefined();
      });
    });

    it('affiche un message générique en cas d’échec réseau/API', async () => {
      stubFetch({
        demandeBusiness: { status: 500, corps: { statusCode: 500, message: 'Erreur interne' } },
      });
      const { element } = renderAvecProviders(<BillingSelfServicePage />);
      render(element);

      await waitFor(() => expect(screen.getByText('Business')).toBeDefined());
      fireEvent.click(screen.getByText('Nous contacter'));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());
      remplirChamps();
      fireEvent.click(screen.getByText('Envoyer ma demande'));

      await waitFor(() => {
        expect(
          screen.getByText(
            'Impossible d’envoyer votre demande pour le moment. Vérifiez votre connexion et réessayez.',
          ),
        ).toBeDefined();
      });
    });

    it('ferme la modale avec le bouton X', async () => {
      await ouvrirModalContact();
      fireEvent.click(screen.getByLabelText('Fermer'));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
    });

    it('ferme la modale avec la touche Escape', async () => {
      await ouvrirModalContact();
      fireEvent.keyDown(window, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
    });

    it('ferme la modale sur Annuler sans appeler l’API', async () => {
      const fetchMock = stubFetch();
      const { element } = renderAvecProviders(<BillingSelfServicePage />);
      render(element);

      await waitFor(() => expect(screen.getByText('Business')).toBeDefined());
      fireEvent.click(screen.getByText('Nous contacter'));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());

      fireEvent.click(screen.getByText('Annuler'));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
      const appelEnvoi = fetchMock.mock.calls.some(
        ([input, init]) =>
          String(input).includes('/demandes-business') &&
          (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(appelEnvoi).toBe(false);
    });
  });
});
