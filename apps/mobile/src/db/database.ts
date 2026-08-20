import { Database } from '@nozbe/watermelondb';
import type { DatabaseAdapter } from '@nozbe/watermelondb/adapters/type';
import { Client } from './models/Client';
import { Commande } from './models/Commande';
import { CommandeArticle } from './models/CommandeArticle';
import { OperationCaisse } from './models/OperationCaisse';

// Adaptateur injecté plutôt que codé en dur : en test (et pour cette
// tranche "couche de données" sans écran), l'adaptateur LokiJS en
// mémoire suffit et ne nécessite aucun binding natif (voir
// db/test-adapter.ts). Le branchement de l'adaptateur SQLite natif réel
// (@nozbe/watermelondb/adapters/sqlite) est différé à l'implémentation
// des écrans mobiles, qui nécessite de toute façon un appareil/simulateur
// pour être vérifiée — voir specs/016-mobile-offline/spec.md.
export function creerBaseLocale(adapter: DatabaseAdapter): Database {
  return new Database({
    adapter,
    modelClasses: [Client, Commande, CommandeArticle, OperationCaisse],
  });
}
