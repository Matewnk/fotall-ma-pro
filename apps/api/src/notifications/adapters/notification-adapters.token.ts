// Les interfaces TypeScript n'existent pas au runtime : Nest ne peut pas
// injecter "toutes les implémentations de NotificationAdapter" par simple
// typage. Un jeton d'injection explicite + une factory (voir
// notifications.module.ts) rassemblent les trois adaptateurs concrets.
export const NOTIFICATION_ADAPTERS = 'NOTIFICATION_ADAPTERS';
