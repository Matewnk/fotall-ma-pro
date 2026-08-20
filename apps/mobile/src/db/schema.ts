import { appSchema, tableSchema } from '@nozbe/watermelondb';

// Stockage local (SQLite via WatermelonDB, cahier des charges §18 /
// CLAUDE.md "Offline"). Périmètre de cette tranche : les 3 opérations
// prioritaires hors-ligne (§18.1) — commande, caisse, statut — plus la
// consultation/édition locale des clients déjà synchronisés.
//
// Chaque table porte les colonnes de traçabilité exigées par la
// mutation offline (§18.2) : device_id, idempotency_key,
// local_created_at, synced_at (null = en attente de synchronisation).
// tenant_id n'est volontairement pas répété par ligne : une base locale
// appartient à une seule session tenant à la fois (comme le JWT côté
// API), voir offline/types.ts.
export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'clients',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'nom', type: 'string' },
        { name: 'telephone', type: 'string' },
        { name: 'email', type: 'string', isOptional: true },
        { name: 'adresse', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        // Horodatage par champ : nécessaire à la fusion §18.3 ("Client :
        // fusion champ par champ selon le timestamp du champ").
        { name: 'nom_updated_at', type: 'number' },
        { name: 'telephone_updated_at', type: 'number' },
        { name: 'email_updated_at', type: 'number', isOptional: true },
        { name: 'adresse_updated_at', type: 'number', isOptional: true },
        { name: 'notes_updated_at', type: 'number', isOptional: true },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'commandes',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'numero', type: 'number', isOptional: true },
        { name: 'client_server_id', type: 'string', isIndexed: true },
        { name: 'statut', type: 'string' },
        { name: 'sous_total', type: 'string' },
        { name: 'remise', type: 'string' },
        { name: 'total', type: 'string' },
        { name: 'mode_livraison', type: 'string' },
        { name: 'adresse_livraison', type: 'string', isOptional: true },
        { name: 'date_prevue', type: 'number', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'device_id', type: 'string' },
        { name: 'idempotency_key', type: 'string', isIndexed: true },
        { name: 'local_created_at', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
        // Dernier statut confirmé par le serveur (distinct de synced_at,
        // qui ne marque que la création) : un TECHNICIEN peut faire
        // progresser une commande déjà synchronisée pendant une coupure
        // réseau ultérieure. "à pousser" = statut ≠ derniere_statut_poussee.
        { name: 'derniere_statut_poussee', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'commande_articles',
      columns: [
        { name: 'commande_local_id', type: 'string', isIndexed: true },
        { name: 'service_id', type: 'string' },
        { name: 'quantite', type: 'number' },
        { name: 'tarif_unitaire', type: 'string' },
        { name: 'sous_total', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'operations_caisse',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'type', type: 'string' },
        { name: 'montant', type: 'string' },
        { name: 'mode_paiement', type: 'string', isOptional: true },
        { name: 'reference', type: 'string', isOptional: true },
        { name: 'commande_server_id', type: 'string', isOptional: true },
        { name: 'device_id', type: 'string' },
        { name: 'idempotency_key', type: 'string', isIndexed: true },
        { name: 'local_created_at', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),
  ],
});
