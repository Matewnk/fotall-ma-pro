# Permissions granulaires — Fotall-Ma Pro

## Objectif

Permettre à un ADMIN d'accorder ou de retirer, utilisateur par utilisateur
et permission par permission, des droits d'accès plus fins que le rôle seul
(`ADMIN`, `CAISSIER`, `TECHNICIEN`, `LIVREUR`), sans jamais fusionner les
rôles ni contourner l'isolation multi-tenant. Cadrage validé par le
propriétaire produit le 2026-08-24 (voir rapport d'audit dans l'historique
de conversation) : modèle d'autorisation Option C (RBAC + overrides
ALLOW/DENY), spec `021-permissions-granulaires`, plan en 5 phases.

## Références

- `docs/cahier-des-charges.md` (§2 — rôles et autorisations, §2.2 — règle RBAC)
- `.specify/memory/constitution.md`
- `docs/architecture/architecture.md`
- `docs/decisions/ADR-005-permissions-granulaires.md`
- `specs/002-identity-tenancy/`, `specs/015-web/` (`UsersController`/`UsersPage.tsx` existants)
- `specs/018-audit-security/spec.md` (périmètre différé : audit des modifications utilisateurs, à combler ici)

## Clarifications retenues

Confirmées par le propriétaire produit le 2026-08-24 (aucune objection sur
les points proposés) :

1. `users.manage` / `users.permissions` non-configurables — jamais
   d'override, toujours `ADMIN` seul.
2. SERVICES et TARIFS fusionnés en un seul domaine de permission.
3. `commandes.update-statut`, `livraisons.update-statut`,
   `traitement.update-statut` : trois permissions distinctes.
4. Audit des changements de permission : réutilisation d'`AuditLog` existant
   (pas de table dédiée) ; le gap d'audit sur `UsersService` est comblé dans
   cette même spec (Phase 2), pas séparément.
5. Mobile : aucun écran de gestion des permissions (web uniquement).

Ajustements découverts pendant l'implémentation (T3.3-T3.4), pour préserver
le comportement RBAC actuel sans changement non sollicité :

6. `stocks.update` ajouté au catalogue (absent du brouillon initial) —
   ADMIN uniquement, comme `stocks.create`/`stocks.delete`.
7. `tickets.delivery-slip` ajouté au défaut TECHNICIEN — `TicketsController`
   donne déjà ce droit à TECHNICIEN via son `@Roles` de classe actuel.
8. `clients.delete` retiré du défaut CAISSIER — confirmé explicitement par
   le propriétaire produit le 2026-08-24 : c'est un changement de
   comportement réel (suppression définitive, sans corbeille), volontaire.
9. Trois endpoints (`OrdersController#updateStatut`, `CashController#enregistrer`,
   `ReportsController` sur la distinction read/export) restent gouvernés par
   `@Roles` seul, sans `@RequirePermission` : chacun sert plusieurs
   permissions conceptuellement distinctes de la matrice via un unique
   endpoint (le type d'opération, ou `?format=`), et `@RequirePermission`
   ne porte qu'une permission statique par route. Nécessite soit de scinder
   la route, soit un contrôle dynamique dans le service — décision différée,
   voir `tasks.md`.

## Rôles — rappel (ne jamais fusionner)

`SUPER_ADMIN` reste entièrement hors de ce système : ses droits plateforme
restent gouvernés uniquement par `@Roles(Role.SUPER_ADMIN)`, sans notion de
permission granulaire. Le système de permissions granulaires ne s'applique
qu'à `ADMIN`, `CAISSIER`, `TECHNICIEN`, `LIVREUR` au sein d'un tenant.

## Modèle d'autorisation

RBAC + overrides `ALLOW`/`DENY` explicites (Option C, ADR-005). Priorité de
résolution stricte pour toute permission `p` d'un utilisateur `u` :

1. Un override `DENY` explicite sur `p` pour `u` → refusé, quel que soit le
   défaut du rôle.
2. Un override `ALLOW` explicite sur `p` pour `u` → autorisé, même si `p`
   n'est pas dans le défaut du rôle.
3. Sinon, valeur par défaut du rôle de `u` dans la matrice (✅/❌).

`users.manage` et `users.permissions` ne sont jamais éligibles à un override
(ni `ALLOW` ni `DENY`) — toujours strictement `ADMIN`. Le catalogue de
permissions valides est une liste fermée côté serveur ; toute permission
inconnue envoyée par le client est rejetée (validation stricte, même pattern
que `CreateUserDto`/`ROLES_GERABLES_PAR_ADMIN`).

## Domaines et permissions (catalogue)

```
CLIENTS      : clients.read, clients.create, clients.update, clients.delete
SERVICES     : services.read, services.create, services.update, services.delete
COMMANDES    : commandes.read, commandes.create, commandes.update-statut, commandes.encaisser
CAISSE       : caisse.read, caisse.encaisser, caisse.avance, caisse.depense, caisse.remboursement, caisse.cloture
STOCKS       : stocks.read, stocks.create, stocks.update, stocks.adjust, stocks.delete
TICKETS      : tickets.read, tickets.print, tickets.delivery-slip
UTILISATEURS : users.manage, users.permissions   (non-configurables)
RAPPORTS     : reports.read, reports.export
LIVRAISONS   : livraisons.read, livraisons.update-statut
TRAITEMENT   : traitement.read, traitement.update-statut
```

`commandes.update-statut`, `livraisons.update-statut` et
`traitement.update-statut` sont trois permissions distinctes (et non une
permission unique), pour permettre un override indépendant par métier
(TECHNICIEN vs LIVREUR ont des transitions de statut différentes).

SERVICES et TARIFS sont fusionnés en un seul domaine : le code actuel
(`services.controller.ts`) ne sépare pas catalogue et tarification.

## Modèle de données proposé (à créer en Phase 1, control-plane)

```prisma
model UserPermission {
  id           String   @id @default(uuid())
  userId       String   @map("user_id")
  tenantId     String   @map("tenant_id")
  permission   String
  effet        String   // "ALLOW" | "DENY"
  accordePar   String   @map("accorde_par")
  createdAt    DateTime @default(now()) @map("created_at")

  user   User   @relation(fields: [userId], references: [id])
  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([userId, permission])
  @@index([tenantId])
  @@map("user_permissions")
}
```

`tenantId` dupliqué sur la table (comme `AuditLog`) : chaque requête filtre
directement `WHERE userId = ? AND tenantId = ?` avec `tenantId` dérivé du
`TenantContext` serveur, jamais du client.

## Sécurité multi-tenant

Aucune donnée `UserPermission` d'un tenant ne doit être visible, modifiable
ou devinable par un autre tenant. Réplique exacte du pattern déjà prouvé
dans `UsersService.update()` (`findFirst({ id, tenantId })`).

5 scénarios d'attaque devant rester couverts par test (détail dans le
rapport d'audit) : accès admin cross-tenant → refusé (404) ; élévation
CAISSIER → ADMIN via permission → impossible (`users.manage`/
`users.permissions` non-configurables) ; appel API direct contournant un
bouton masqué → 403 ; manipulation JS d'un bouton masqué → sans effet
(backend seul fait autorité) ; CAISSIER appelant `users.permissions` → 403.

## Audit

Chaque `ALLOW`/`DENY` accordé ou révoqué est journalisé via l'`AuditService`
existant (tenant-scopé), `entityType = 'UserPermission'`,
`metadata = { permission, effet, ancienEtat, nouvelEtat }`.

Cette spec comble également le gap identifié dans
`specs/018-audit-security/spec.md` (périmètre différé "modifications
utilisateurs") : `UsersService` (création, changement de rôle, désactivation,
réinitialisation de mot de passe) doit être branché sur `AuditService` en
Phase 2, indépendamment du reste du système de permissions.

## UX (texte uniquement — aucune maquette modifiée dans cette phase)

Web : bouton "Permissions" ajouté à la colonne Actions de `UsersPage.tsx`,
ouvrant un écran par domaine avec cases à cocher (héritées grisées,
overrides actifs éditables), badge "Personnalisé" sur tout override.
Aucun nouvel item de navigation racine.

Mobile : décision révisée à la demande explicite de l'utilisateur (2026-08-26,
chantier de parité web/mobile) — `UsersScreen.tsx` porte désormais son propre
panneau de permissions par domaine (mêmes contrats API, catalogue dupliqué
dans `apps/mobile/src/lib/permissions.ts`). L'"Option A" (mobile web-only) ne
s'applique plus : `/branding` (`BrandingScreen.tsx`) et `/audit`
(`AuditScreen.tsx`) ont reçu le même traitement, à la même demande explicite.

## Périmètre différé

- Rotation/expiration de session liée à un changement de permission
  (au-delà de la revalidation déjà faite par `jwt.strategy.ts` à chaque
  requête, qui reste suffisante).

## Critères d'acceptation

- [ ] Modèle `UserPermission` créé (control-plane), migration appliquée.
- [ ] `PermissionsGuard` + `@RequirePermission(...)` opérationnels, priorité
      DENY > ALLOW > défaut du rôle prouvée par test.
- [ ] `UsersService` journalise ses mutations via `AuditService`.
- [ ] Endpoints ADMIN de gestion des permissions (lister/accorder/révoquer),
      tenant-scopés, catalogue fermé.
- [ ] Tests unitaires (résolution de permission effective, toutes
      combinaisons rôle × permission × override).
- [ ] Tests d'intégration par rôle (200/201 avec permission, 403 sans).
- [ ] Tests cross-tenant dédiés `UserPermission` (GET/LIST/UPDATE/DELETE/
      export/ID forgé/JWT incorrect).
- [ ] Extension de `security.integration.spec.ts` (§21.3).
- [ ] UI web (`UsersPage.tsx` + écran Permissions), tests E2E.
- [ ] Documentation mise à jour (constitution, architecture, cahier des
      charges §2).
