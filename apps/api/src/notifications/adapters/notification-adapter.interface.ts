import { CanalNotification } from '../../generated/tenant-client';

// Contrat commun aux trois canaux (cahier des charges §8.3) : le domaine
// métier (Commande, Licence, Onboarding) n'importe jamais un adaptateur
// directement, seulement NotificationsService. Un adaptateur ne fait
// qu'envoyer ; retry/idempotence/journal restent la responsabilité du
// service, pas de l'adaptateur.
export interface NotificationAdapter {
  readonly canal: CanalNotification;
  envoyer(destinataire: string, message: string): Promise<void>;
}
