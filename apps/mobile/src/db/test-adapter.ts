import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from './schema';

// Adaptateur en mémoire (aucun binding natif) : utilisé uniquement pour
// les tests (Jest/Node), jamais en production — voir database.ts.
export function creerAdaptateurTest(): LokiJSAdapter {
  return new LokiJSAdapter({
    schema,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
    dbName: `test-${Math.random().toString(36).slice(2)}`,
  });
}
