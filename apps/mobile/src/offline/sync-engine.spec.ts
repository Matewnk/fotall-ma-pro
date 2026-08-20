import { Database, Q } from '@nozbe/watermelondb';
import { creerBaseLocale } from '../db/database';
import { creerAdaptateurTest } from '../db/test-adapter';
import { Client } from '../db/models/Client';
import { Commande } from '../db/models/Commande';
import { CommandeArticle } from '../db/models/CommandeArticle';
import { OperationCaisse } from '../db/models/OperationCaisse';
import { ConflitStatutError, type ApiClient } from './api-client';
import {
  fusionnerClientsEnAttente,
  pousserCommandesEnAttente,
  pousserOperationsCaisseEnAttente,
  pousserStatutsEnAttente,
  synchroniser,
} from './sync-engine';

function apiClientFactice(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    creerCommande: jest.fn().mockResolvedValue({ id: 'server-cmd-1', numero: 7 }),
    mettreAJourStatutCommande: jest.fn().mockResolvedValue({ statut: 'EN_COURS' }),
    creerOperationCaisse: jest.fn().mockResolvedValue({ id: 'server-op-1' }),
    recupererClient: jest.fn(),
    modifierClient: jest.fn(),
    ...overrides,
  };
}

async function creerCommandeLocale(
  database: Database,
  attrs: Partial<{
    statut: string;
    syncedAt: Date;
    derniereStatutPoussee: string;
    serverId: string;
  }> = {},
): Promise<Commande> {
  return database.write(async () => {
    const commande = await database.get<Commande>('commandes').create((enregistrement) => {
      enregistrement.clientServerId = 'client-server-1';
      enregistrement.statut = attrs.statut ?? 'EN_ATTENTE';
      enregistrement.sousTotal = '1000';
      enregistrement.remise = '0';
      enregistrement.total = '1000';
      enregistrement.modeLivraison = 'RETRAIT';
      enregistrement.deviceId = 'device-1';
      enregistrement.idempotencyKey = `idem-${Math.random()}`;
      enregistrement.localCreatedAt = new Date();
      if (attrs.syncedAt) {
        enregistrement.syncedAt = attrs.syncedAt;
      }
      if (attrs.derniereStatutPoussee !== undefined) {
        enregistrement.derniereStatutPoussee = attrs.derniereStatutPoussee;
      }
      if (attrs.serverId !== undefined) {
        enregistrement.serverId = attrs.serverId;
      }
    });
    await database.get<CommandeArticle>('commande_articles').create((article) => {
      article.commandeLocalId = commande.id;
      article.serviceId = 'service-1';
      article.quantite = 2;
      article.tarifUnitaire = '500';
      article.sousTotal = '1000';
    });
    return commande;
  });
}

describe('sync-engine (016-mobile-offline)', () => {
  let database: Database;

  beforeEach(() => {
    database = creerBaseLocale(creerAdaptateurTest());
  });

  describe('pousserCommandesEnAttente', () => {
    it('crée les commandes non synchronisées et réconcilie id/numero serveur', async () => {
      const commande = await creerCommandeLocale(database);
      const apiClient = apiClientFactice();

      const resultat = await pousserCommandesEnAttente(database, apiClient);

      expect(resultat).toEqual({ creees: 1, erreurs: [] });
      expect(apiClient.creerCommande).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-server-1',
          articles: [{ serviceId: 'service-1', quantite: 2 }],
        }),
        commande.idempotencyKey,
      );

      const rechargee = await database.get<Commande>('commandes').find(commande.id);
      expect(rechargee.serverId).toBe('server-cmd-1');
      expect(rechargee.numero).toBe(7);
      expect(rechargee.syncedAt).toBeInstanceOf(Date);
    });

    it('ignore les commandes déjà synchronisées', async () => {
      await creerCommandeLocale(database, { syncedAt: new Date(), serverId: 'server-cmd-x' });
      const apiClient = apiClientFactice();

      const resultat = await pousserCommandesEnAttente(database, apiClient);

      expect(resultat.creees).toBe(0);
      expect(apiClient.creerCommande).not.toHaveBeenCalled();
    });

    it('journalise une erreur sans faire échouer les autres commandes', async () => {
      await creerCommandeLocale(database);
      await creerCommandeLocale(database);
      const apiClient = apiClientFactice({
        creerCommande: jest
          .fn()
          .mockRejectedValueOnce(new Error('réseau indisponible'))
          .mockResolvedValueOnce({ id: 'server-cmd-2', numero: 8 }),
      });

      const resultat = await pousserCommandesEnAttente(database, apiClient);

      expect(resultat.creees).toBe(1);
      expect(resultat.erreurs).toHaveLength(1);
      expect(resultat.erreurs[0]).toContain('réseau indisponible');
    });
  });

  describe('pousserStatutsEnAttente', () => {
    it('pousse le statut d’une commande déjà synchronisée dont le statut a changé', async () => {
      const commande = await creerCommandeLocale(database, {
        syncedAt: new Date(),
        serverId: 'server-cmd-1',
        derniereStatutPoussee: 'EN_ATTENTE',
        statut: 'EN_COURS',
      });
      const apiClient = apiClientFactice({
        mettreAJourStatutCommande: jest.fn().mockResolvedValue({ statut: 'EN_COURS' }),
      });

      const resultat = await pousserStatutsEnAttente(database, apiClient);

      expect(resultat).toEqual({ poussees: 1, erreurs: [] });
      expect(apiClient.mettreAJourStatutCommande).toHaveBeenCalledWith('server-cmd-1', 'EN_COURS');

      const rechargee = await database.get<Commande>('commandes').find(commande.id);
      expect(rechargee.derniereStatutPoussee).toBe('EN_COURS');
    });

    it('ne pousse rien pour une commande dont le statut est déjà à jour côté serveur', async () => {
      await creerCommandeLocale(database, {
        syncedAt: new Date(),
        serverId: 'server-cmd-1',
        derniereStatutPoussee: 'EN_ATTENTE',
        statut: 'EN_ATTENTE',
      });
      const apiClient = apiClientFactice();

      const resultat = await pousserStatutsEnAttente(database, apiClient);

      expect(resultat.poussees).toBe(0);
      expect(apiClient.mettreAJourStatutCommande).not.toHaveBeenCalled();
    });

    it('adopte le statut serveur (le plus avancé) en cas de conflit de régression (§18.3)', async () => {
      const commande = await creerCommandeLocale(database, {
        syncedAt: new Date(),
        serverId: 'server-cmd-1',
        derniereStatutPoussee: 'EN_ATTENTE',
        statut: 'EN_COURS',
      });
      const apiClient = apiClientFactice({
        mettreAJourStatutCommande: jest.fn().mockRejectedValue(new ConflitStatutError('LIVRE')),
      });

      const resultat = await pousserStatutsEnAttente(database, apiClient);

      expect(resultat.poussees).toBe(0);
      expect(resultat.erreurs).toHaveLength(0);

      const rechargee = await database.get<Commande>('commandes').find(commande.id);
      expect(rechargee.statut).toBe('LIVRE');
      expect(rechargee.derniereStatutPoussee).toBe('LIVRE');
    });
  });

  describe('pousserOperationsCaisseEnAttente', () => {
    it('pousse chaque opération en attente et marque la synchronisation (append-only, §18.3)', async () => {
      const operation = await database.write(() =>
        database.get<OperationCaisse>('operations_caisse').create((enregistrement) => {
          enregistrement.type = 'ENCAISSEMENT';
          enregistrement.montant = '2000';
          enregistrement.modePaiement = 'ESPECES';
          enregistrement.deviceId = 'device-1';
          enregistrement.idempotencyKey = 'idem-caisse-1';
          enregistrement.localCreatedAt = new Date();
        }),
      );
      const apiClient = apiClientFactice();

      const resultat = await pousserOperationsCaisseEnAttente(database, apiClient);

      expect(resultat).toEqual({ poussees: 1, erreurs: [] });
      const rechargee = await database.get<OperationCaisse>('operations_caisse').find(operation.id);
      expect(rechargee.serverId).toBe('server-op-1');
      expect(rechargee.syncedAt).toBeInstanceOf(Date);
    });
  });

  describe('fusionnerClientsEnAttente', () => {
    it('fusionne champ par champ et pousse le résultat, seulement pour les clients modifiés localement', async () => {
      const maintenant = new Date();
      const ilYA10Jours = new Date(maintenant.getTime() - 10 * 24 * 60 * 60 * 1000);
      const client = await database.write(() =>
        database.get<Client>('clients').create((enregistrement) => {
          enregistrement.serverId = 'server-client-1';
          enregistrement.nom = 'Fatou Sy (corrigé)';
          enregistrement.telephone = '+221701112233';
          enregistrement.nomUpdatedAt = maintenant;
          enregistrement.telephoneUpdatedAt = ilYA10Jours;
          enregistrement.syncedAt = ilYA10Jours;
        }),
      );
      const apiClient = apiClientFactice({
        recupererClient: jest.fn().mockResolvedValue({
          nom: 'Fatou Sy',
          telephone: '+221709998877',
          updatedAt: new Date(maintenant.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        modifierClient: jest.fn().mockResolvedValue({ updatedAt: maintenant.toISOString() }),
      });

      const resultat = await fusionnerClientsEnAttente(database, apiClient);

      expect(resultat).toEqual({ fusionnes: 1, erreurs: [] });
      expect(apiClient.modifierClient).toHaveBeenCalledWith(
        'server-client-1',
        expect.objectContaining({ nom: 'Fatou Sy (corrigé)', telephone: '+221709998877' }),
      );

      const rechargee = await database.get<Client>('clients').find(client.id);
      expect(rechargee.nom).toBe('Fatou Sy (corrigé)');
      expect(rechargee.telephone).toBe('+221709998877');
    });

    it('ne touche pas un client sans modification locale récente', async () => {
      const passe = new Date('2026-01-01T00:00:00Z');
      await database.write(() =>
        database.get<Client>('clients').create((enregistrement) => {
          enregistrement.serverId = 'server-client-2';
          enregistrement.nom = 'Client Stable';
          enregistrement.telephone = '+221700000000';
          enregistrement.nomUpdatedAt = passe;
          enregistrement.telephoneUpdatedAt = passe;
          enregistrement.syncedAt = new Date();
        }),
      );
      const apiClient = apiClientFactice();

      const resultat = await fusionnerClientsEnAttente(database, apiClient);

      expect(resultat).toEqual({ fusionnes: 0, erreurs: [] });
      expect(apiClient.recupererClient).not.toHaveBeenCalled();
    });
  });

  describe('synchroniser', () => {
    it('exécute les 4 flux et agrège un résultat "SYNCHRONISE" sans erreur', async () => {
      await creerCommandeLocale(database);
      const apiClient = apiClientFactice();

      const resultat = await synchroniser(database, apiClient);

      expect(resultat.statut).toBe('SYNCHRONISE');
      expect(resultat.commandesCreees).toBe(1);
      expect(resultat.erreurs).toHaveLength(0);
      expect(resultat.derniereSynchronisationAt).toBeInstanceOf(Date);
    });

    it('retombe sur "ERREUR" si au moins un flux échoue', async () => {
      await creerCommandeLocale(database);
      const apiClient = apiClientFactice({
        creerCommande: jest.fn().mockRejectedValue(new Error('hors ligne')),
      });

      const resultat = await synchroniser(database, apiClient);

      expect(resultat.statut).toBe('ERREUR');
      expect(resultat.erreurs).toHaveLength(1);
    });
  });
});

// Sanity check indépendant : confirme que Q.where('synced_at', null) est
// bien la bonne façon d'interroger les lignes en attente (utilisé par
// tous les "pousser*EnAttente" ci-dessus) — sert de garde-fou si
// l'implémentation de la requête change.
describe('requête "en attente de synchronisation"', () => {
  it('Q.where(col, null) ne retourne que les lignes où la colonne est absente', async () => {
    const database = creerBaseLocale(creerAdaptateurTest());
    await database.write(async () => {
      await database.get<Commande>('commandes').create((c) => {
        c.clientServerId = 'x';
        c.statut = 'EN_ATTENTE';
        c.sousTotal = '0';
        c.remise = '0';
        c.total = '0';
        c.modeLivraison = 'RETRAIT';
        c.deviceId = 'd';
        c.idempotencyKey = 'a';
        c.localCreatedAt = new Date();
      });
      await database.get<Commande>('commandes').create((c) => {
        c.clientServerId = 'x';
        c.statut = 'EN_ATTENTE';
        c.sousTotal = '0';
        c.remise = '0';
        c.total = '0';
        c.modeLivraison = 'RETRAIT';
        c.deviceId = 'd';
        c.idempotencyKey = 'b';
        c.localCreatedAt = new Date();
        c.syncedAt = new Date();
      });
    });

    const enAttente = await database
      .get<Commande>('commandes')
      .query(Q.where('synced_at', null))
      .fetch();
    expect(enAttente).toHaveLength(1);
    expect(enAttente[0]?.idempotencyKey).toBe('a');
  });
});
