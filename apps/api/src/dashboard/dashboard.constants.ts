// Le cahier des charges (§4.3) demande une alerte "commandes urgentes" sans
// en définir le seuil. Interprétation retenue : une commande non livrée dont
// la date prévue tombe dans les deux prochaines heures.
export const FENETRE_URGENCE_HEURES = 2;

export const NB_COMMANDES_RECENTES = 10;

export const NB_JOURS_REVENUS = 7;
