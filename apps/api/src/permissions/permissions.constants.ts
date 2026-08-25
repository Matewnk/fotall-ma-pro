import { Role } from '@prisma/client';

// Catalogue ferme (021-permissions-granulaires) : toute permission hors de
// cette liste est rejetee par validation (@IsIn), meme pattern que
// ROLES_GERABLES_PAR_ADMIN pour les roles.
export const PERMISSIONS_CONNUES = [
  'clients.read',
  'clients.create',
  'clients.update',
  'clients.delete',
  'services.read',
  'services.create',
  'services.update',
  'services.delete',
  'commandes.read',
  'commandes.create',
  'commandes.update-statut',
  'commandes.encaisser',
  'caisse.read',
  'caisse.encaisser',
  'caisse.avance',
  'caisse.depense',
  'caisse.remboursement',
  'caisse.cloture',
  'stocks.read',
  'stocks.create',
  'stocks.update',
  'stocks.adjust',
  'stocks.delete',
  'tickets.read',
  'tickets.print',
  'tickets.delivery-slip',
  'users.manage',
  'users.permissions',
  'reports.read',
  'reports.export',
  'livraisons.read',
  'livraisons.update-statut',
  'traitement.read',
  'traitement.update-statut',
] as const;

export type Permission = (typeof PERMISSIONS_CONNUES)[number];

// Jamais eligibles a un override ALLOW/DENY : toujours strictement ADMIN,
// pour empecher toute elevation de privilege deguisee en changement de
// permission (cf. ADR-005, spec.md "Modele d'autorisation").
export const PERMISSIONS_NON_CONFIGURABLES: ReadonlySet<Permission> = new Set([
  'users.manage',
  'users.permissions',
]);

// Defauts par role (marque ✅ dans specs/021-permissions-granulaires/spec.md).
// ADMIN possede par defaut la totalite du catalogue. Ces defauts restent
// codes en dur et versionnes (pas de table RolePermission en base) — voir
// plan.md "Analyze".
const DEFAUT_CAISSIER: Permission[] = [
  'clients.read',
  'clients.create',
  'clients.update',
  'services.read',
  'commandes.read',
  'commandes.create',
  'commandes.update-statut',
  'commandes.encaisser',
  'caisse.read',
  'caisse.encaisser',
  'caisse.avance',
  'caisse.depense',
  'caisse.remboursement',
  'caisse.cloture',
  'stocks.read',
  'tickets.read',
  'tickets.print',
  'tickets.delivery-slip',
];

const DEFAUT_TECHNICIEN: Permission[] = [
  'commandes.read',
  'commandes.update-statut',
  'stocks.read',
  'stocks.adjust',
  'tickets.read',
  'tickets.print',
  // Comportement actuel de TicketsController preserve (021-permissions-
  // granulaires) : @Roles(ADMIN, CAISSIER, TECHNICIEN, LIVREUR) au niveau
  // du controleur donne deja acces au bon de livraison a TECHNICIEN.
  'tickets.delivery-slip',
  'traitement.read',
  'traitement.update-statut',
];

const DEFAUT_LIVREUR: Permission[] = [
  'commandes.read',
  'tickets.read',
  'tickets.print',
  'tickets.delivery-slip',
  'livraisons.read',
  'livraisons.update-statut',
];

export const PERMISSIONS_PAR_DEFAUT_DU_ROLE: Record<Role, ReadonlySet<Permission>> = {
  [Role.SUPER_ADMIN]: new Set(), // hors perimetre : gouverne uniquement par @Roles(SUPER_ADMIN)
  [Role.ADMIN]: new Set(PERMISSIONS_CONNUES),
  [Role.CAISSIER]: new Set(DEFAUT_CAISSIER),
  [Role.TECHNICIEN]: new Set(DEFAUT_TECHNICIEN),
  [Role.LIVREUR]: new Set(DEFAUT_LIVREUR),
};
