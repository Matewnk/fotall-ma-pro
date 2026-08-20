// §14.1 : "relances automatiques". Faute de politique commerciale
// explicite dans le cahier des charges, un délai de grâce raisonnable
// est retenu ici et documenté — à ajuster si une politique différente
// est communiquée. Après ce délai en statut EN_RETARD, l'abonnement
// entraîne la suspension de la licence (§13.3 : "la transition exacte
// entre expiration de période payée et suspension doit rester alignée
// avec le module de facturation").
export const JOURS_GRACE_AVANT_SUSPENSION = 7;

// Acteur technique enregistré dans JournalLicence.effectuePar (simple
// chaîne descriptive, pas une clé étrangère vers User) quand une
// transition de licence est déclenchée par un évènement de paiement
// plutôt que par une action humaine.
export const ACTEUR_SYSTEME_FACTURATION = 'systeme:facturation';

// Cycle de facturation (§14.1 : "abonnement mensuel").
export const JOURS_CYCLE_FACTURATION = 30;
