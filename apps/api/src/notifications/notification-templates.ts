import { TypeEvenementNotification } from '../generated/tenant-client';

// Un seul texte par événement, valable pour SMS/WhatsApp (limite de
// longueur) et comme corps de notification PUSH. Configurable par tenant
// dans une future spec si besoin (cahier des charges §8 : "templates
// configurables par tenant") — pour l'instant un seul jeu de templates
// globaux, suffisant pour prouver le mécanisme.
export type DonneesTemplate = Record<string, string | number>;

const TEMPLATES: Record<TypeEvenementNotification, (donnees: DonneesTemplate) => string> = {
  COMMANDE_CREEE: (d) => `Votre commande #${d.numero} a été enregistrée chez ${d.nomPressing}.`,
  COMMANDE_EN_COURS: (d) => `Votre commande #${d.numero} est en cours de traitement.`,
  COMMANDE_PRETE: (d) => `Votre commande #${d.numero} est prête chez ${d.nomPressing}.`,
  LIVRAISON_PREVUE: (d) => `Votre commande #${d.numero} sera livrée prochainement.`,
  COMMANDE_LIVREE: (d) => `Votre commande #${d.numero} a été livrée. Merci de votre confiance !`,
  RAPPEL: (d) => `Rappel : votre commande #${d.numero} vous attend chez ${d.nomPressing}.`,
  LICENCE_PROCHE_EXPIRATION: (d) =>
    `Votre essai gratuit Fotall-Ma Pro se termine le ${d.dateFinEssai}. Contactez-nous pour continuer.`,
  TEST_CANAL: (d) =>
    `Ceci est un message de test depuis ${d.nomPressing}. Votre canal fonctionne !`,
};

export function rendreTemplate(
  evenement: TypeEvenementNotification,
  donnees: DonneesTemplate,
): string {
  return TEMPLATES[evenement](donnees);
}
