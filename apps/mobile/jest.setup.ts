import logger from '@nozbe/watermelondb/utils/common/logger';

// L'adaptateur LokiJS de test (db/test-adapter.ts) journalise chaque
// étape d'initialisation par défaut — bruit sans valeur en CI.
logger.silence();
