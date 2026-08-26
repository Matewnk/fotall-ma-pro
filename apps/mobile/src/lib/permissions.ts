// Catalogue de permissions côté mobile, miroir de apps/web/src/lib/
// permissions.ts (lui-même miroir de apps/api/src/permissions/
// permissions.constants.ts). users.manage/users.permissions sont exclus :
// jamais configurables, jamais affichés dans ce panneau.
export type DomainePermission = {
  domaine: string;
  permissions: { valeur: string; libelle: string }[];
};

export const CATALOGUE_PERMISSIONS: DomainePermission[] = [
  {
    domaine: 'Clients',
    permissions: [
      { valeur: 'clients.read', libelle: 'Consulter les clients' },
      { valeur: 'clients.create', libelle: 'Créer un client' },
      { valeur: 'clients.update', libelle: 'Modifier un client' },
      { valeur: 'clients.delete', libelle: 'Supprimer un client' },
    ],
  },
  {
    domaine: 'Services & tarifs',
    permissions: [
      { valeur: 'services.read', libelle: 'Consulter les services' },
      { valeur: 'services.create', libelle: 'Créer un service' },
      { valeur: 'services.update', libelle: 'Modifier un service' },
      { valeur: 'services.delete', libelle: 'Supprimer un service' },
    ],
  },
  {
    domaine: 'Commandes',
    permissions: [
      { valeur: 'commandes.read', libelle: 'Consulter les commandes' },
      { valeur: 'commandes.create', libelle: 'Créer une commande' },
      { valeur: 'commandes.update-statut', libelle: 'Changer le statut' },
      { valeur: 'commandes.encaisser', libelle: 'Encaisser une commande' },
    ],
  },
  {
    domaine: 'Caisse',
    permissions: [
      { valeur: 'caisse.read', libelle: 'Consulter le journal de caisse' },
      { valeur: 'caisse.encaisser', libelle: 'Encaisser' },
      { valeur: 'caisse.avance', libelle: 'Enregistrer une avance' },
      { valeur: 'caisse.depense', libelle: 'Enregistrer une dépense' },
      { valeur: 'caisse.remboursement', libelle: 'Enregistrer un remboursement' },
      { valeur: 'caisse.cloture', libelle: 'Clôturer la caisse' },
    ],
  },
  {
    domaine: 'Stocks & consommables',
    permissions: [
      { valeur: 'stocks.read', libelle: 'Consulter les stocks' },
      { valeur: 'stocks.create', libelle: 'Créer un article' },
      { valeur: 'stocks.update', libelle: 'Modifier un article' },
      { valeur: 'stocks.adjust', libelle: 'Enregistrer un mouvement' },
      { valeur: 'stocks.delete', libelle: 'Supprimer un article' },
    ],
  },
  {
    domaine: 'Tickets',
    permissions: [
      { valeur: 'tickets.read', libelle: 'Consulter les tickets' },
      { valeur: 'tickets.print', libelle: 'Imprimer un ticket' },
      { valeur: 'tickets.delivery-slip', libelle: 'Bon de livraison' },
    ],
  },
  {
    domaine: 'Rapports',
    permissions: [
      { valeur: 'reports.read', libelle: 'Consulter les rapports' },
      { valeur: 'reports.export', libelle: 'Exporter (CSV/PDF)' },
    ],
  },
  {
    domaine: 'Livraisons',
    permissions: [
      { valeur: 'livraisons.read', libelle: 'Consulter les livraisons' },
      { valeur: 'livraisons.update-statut', libelle: 'Changer le statut de livraison' },
    ],
  },
  {
    domaine: 'Traitement',
    permissions: [
      { valeur: 'traitement.read', libelle: 'Consulter le traitement' },
      { valeur: 'traitement.update-statut', libelle: 'Changer le statut de traitement' },
    ],
  },
];
