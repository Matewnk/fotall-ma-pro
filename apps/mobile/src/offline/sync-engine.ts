import { Database, Q } from '@nozbe/watermelondb';
import { Client } from '../db/models/Client';
import { Commande } from '../db/models/Commande';
import { OperationCaisse } from '../db/models/OperationCaisse';
import { ConflitStatutError, type ApiClient } from './api-client';
import { fusionnerClient, resoudreConflitStatut } from './conflict-resolution';
import type { StatutCommande, StatutSynchronisation } from './types';

export interface ResultatSynchronisation {
  statut: StatutSynchronisation;
  commandesCreees: number;
  statutsPoussés: number;
  operationsCaissePoussees: number;
  clientsFusionnes: number;
  erreurs: string[];
  derniereSynchronisationAt: Date;
}

function messageErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur);
}

// §18.3 "Commande créée offline" : pousse chaque commande non encore
// créée côté serveur (synced_at absent), avec la même idempotencyKey
// que celle assignée localement (§18.2) — un rejeu réseau ne crée
// jamais deux fois la même commande (idempotence déjà garantie côté
// API, 009). Aucun conflit métier possible à cette étape : seule une
// réconciliation d'identifiant (id + numero serveur) est nécessaire.
export async function pousserCommandesEnAttente(
  database: Database,
  apiClient: ApiClient,
): Promise<{ creees: number; erreurs: string[] }> {
  const commandes = await database
    .get<Commande>('commandes')
    .query(Q.where('synced_at', null))
    .fetch();
  let creees = 0;
  const erreurs: string[] = [];

  for (const commande of commandes) {
    try {
      const articles = await commande.articles.fetch();
      const reponse = await apiClient.creerCommande(
        {
          clientId: commande.clientServerId,
          articles: articles.map((article) => ({
            serviceId: article.serviceId,
            quantite: article.quantite,
          })),
          modeLivraison: commande.modeLivraison,
          ...(commande.adresseLivraison !== null
            ? { adresseLivraison: commande.adresseLivraison }
            : {}),
          ...(commande.datePrevue !== null
            ? { datePrevue: commande.datePrevue.toISOString() }
            : {}),
          ...(commande.notes !== null ? { notes: commande.notes } : {}),
        },
        commande.idempotencyKey,
      );

      await database.write(async () => {
        await commande.update((enregistrement) => {
          enregistrement.serverId = reponse.id;
          enregistrement.numero = reponse.numero;
          enregistrement.syncedAt = new Date();
          enregistrement.derniereStatutPoussee = commande.statut;
        });
      });
      creees += 1;
    } catch (erreur) {
      erreurs.push(`commande ${commande.idempotencyKey} : ${messageErreur(erreur)}`);
    }
  }

  return { creees, erreurs };
}

// §18.3 "Statut commande" : le statut le plus avancé gagne. Le serveur
// refuse déjà toute régression (ConflictException, orders.service.ts) —
// si le push échoue pour cette raison, on adopte le statut renvoyé par
// le serveur localement plutôt que de réessayer indéfiniment un
// changement que le serveur n'acceptera jamais.
export async function pousserStatutsEnAttente(
  database: Database,
  apiClient: ApiClient,
): Promise<{ poussees: number; erreurs: string[] }> {
  const commandes = await database
    .get<Commande>('commandes')
    .query(Q.where('synced_at', Q.notEq(null)))
    .fetch();
  const aPousser = commandes.filter((commande) => commande.estEnAttenteDePoussageStatut);

  let poussees = 0;
  const erreurs: string[] = [];

  for (const commande of aPousser) {
    if (!commande.serverId) {
      continue;
    }
    try {
      const reponse = await apiClient.mettreAJourStatutCommande(
        commande.serverId,
        commande.statut as StatutCommande,
      );
      await database.write(async () => {
        await commande.update((enregistrement) => {
          enregistrement.derniereStatutPoussee = reponse.statut;
        });
      });
      poussees += 1;
    } catch (erreur) {
      if (erreur instanceof ConflitStatutError) {
        // Le serveur a déjà avancé plus loin (autre appareil, autre
        // opérateur) : on adopte sa vérité localement plutôt que de
        // réessayer un changement qu'il n'acceptera jamais.
        const statutRetenu = resoudreConflitStatut(
          commande.statut as StatutCommande,
          erreur.statutServeur,
        );
        await database.write(async () => {
          await commande.update((enregistrement) => {
            enregistrement.statut = statutRetenu;
            enregistrement.derniereStatutPoussee = statutRetenu;
          });
        });
        continue;
      }
      erreurs.push(`statut commande ${commande.serverId} : ${messageErreur(erreur)}`);
    }
  }

  return { poussees, erreurs };
}

// §18.3 "Caisse" : append-only, aucun écrasement — chaque opération en
// attente est simplement poussée, sans fusion ni résolution de conflit
// (voir conflict-resolution.ts).
export async function pousserOperationsCaisseEnAttente(
  database: Database,
  apiClient: ApiClient,
): Promise<{ poussees: number; erreurs: string[] }> {
  const operations = await database
    .get<OperationCaisse>('operations_caisse')
    .query(Q.where('synced_at', null))
    .fetch();

  let poussees = 0;
  const erreurs: string[] = [];

  for (const operation of operations) {
    try {
      const reponse = await apiClient.creerOperationCaisse(
        {
          type: operation.type,
          montant: operation.montant,
          ...(operation.modePaiement !== null ? { modePaiement: operation.modePaiement } : {}),
          ...(operation.reference !== null ? { reference: operation.reference } : {}),
          ...(operation.commandeServerId !== null
            ? { commandeId: operation.commandeServerId }
            : {}),
        },
        operation.idempotencyKey,
      );
      await database.write(async () => {
        await operation.update((enregistrement) => {
          enregistrement.serverId = reponse.id;
          enregistrement.syncedAt = new Date();
        });
      });
      poussees += 1;
    } catch (erreur) {
      erreurs.push(`opération caisse ${operation.idempotencyKey} : ${messageErreur(erreur)}`);
    }
  }

  return { poussees, erreurs };
}

// §18.3 "Client" : fusion champ par champ selon le timestamp du champ.
// Ne pousse que les clients ayant une modification locale non
// synchronisée (aDesModificationsNonSynchronisees) — la lecture d'un
// client déjà synchronisé ne déclenche jamais d'écriture.
export async function fusionnerClientsEnAttente(
  database: Database,
  apiClient: ApiClient,
): Promise<{ fusionnes: number; erreurs: string[] }> {
  const clients = await database.get<Client>('clients').query().fetch();
  const aFusionner = clients.filter((client) => client.aDesModificationsNonSynchronisees);

  let fusionnes = 0;
  const erreurs: string[] = [];

  for (const client of aFusionner) {
    try {
      const versionServeur = await apiClient.recupererClient(client.serverId);
      const fusion = fusionnerClient(
        {
          nom: client.nom,
          telephone: client.telephone,
          ...(client.email !== null ? { email: client.email } : {}),
          ...(client.adresse !== null ? { adresse: client.adresse } : {}),
          ...(client.notes !== null ? { notes: client.notes } : {}),
        },
        {
          nom: client.nomUpdatedAt,
          telephone: client.telephoneUpdatedAt,
          ...(client.emailUpdatedAt !== null ? { email: client.emailUpdatedAt } : {}),
          ...(client.adresseUpdatedAt !== null ? { adresse: client.adresseUpdatedAt } : {}),
          ...(client.notesUpdatedAt !== null ? { notes: client.notesUpdatedAt } : {}),
        },
        {
          nom: versionServeur.nom,
          telephone: versionServeur.telephone,
          ...(versionServeur.email !== undefined ? { email: versionServeur.email } : {}),
          ...(versionServeur.adresse !== undefined ? { adresse: versionServeur.adresse } : {}),
          ...(versionServeur.notes !== undefined ? { notes: versionServeur.notes } : {}),
        },
        new Date(versionServeur.updatedAt),
      );

      const reponse = await apiClient.modifierClient(client.serverId, fusion);

      await database.write(async () => {
        await client.update((enregistrement) => {
          enregistrement.nom = fusion.nom;
          enregistrement.telephone = fusion.telephone;
          if (fusion.email !== undefined) {
            enregistrement.email = fusion.email;
          }
          if (fusion.adresse !== undefined) {
            enregistrement.adresse = fusion.adresse;
          }
          if (fusion.notes !== undefined) {
            enregistrement.notes = fusion.notes;
          }
          enregistrement.syncedAt = new Date(reponse.updatedAt);
        });
      });
      fusionnes += 1;
    } catch (erreur) {
      erreurs.push(`client ${client.serverId} : ${messageErreur(erreur)}`);
    }
  }

  return { fusionnes, erreurs };
}

// Orchestrateur : exécute les 4 flux dans l'ordre où les dépendances
// l'exigent (une commande doit être créée avant qu'on puisse pousser un
// changement de statut ou une opération de caisse qui la référence par
// son identifiant serveur). §18.4 : le résultat porte tout ce
// qu'un indicateur "synchronisé / en attente / erreur / dernière
// synchronisation" afficherait — l'écran lui-même est différé.
export async function synchroniser(
  database: Database,
  apiClient: ApiClient,
): Promise<ResultatSynchronisation> {
  const commandes = await pousserCommandesEnAttente(database, apiClient);
  const statuts = await pousserStatutsEnAttente(database, apiClient);
  const caisse = await pousserOperationsCaisseEnAttente(database, apiClient);
  const clients = await fusionnerClientsEnAttente(database, apiClient);

  const erreurs = [...commandes.erreurs, ...statuts.erreurs, ...caisse.erreurs, ...clients.erreurs];

  return {
    statut: erreurs.length > 0 ? 'ERREUR' : 'SYNCHRONISE',
    commandesCreees: commandes.creees,
    statutsPoussés: statuts.poussees,
    operationsCaissePoussees: caisse.poussees,
    clientsFusionnes: clients.fusionnes,
    erreurs,
    derniereSynchronisationAt: new Date(),
  };
}
