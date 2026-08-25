# Plan — Permissions granulaires

Documentation seule à ce stade : aucun fichier de code, aucune migration.
Chaque phase ci-dessous ne démarre qu'après feu vert explicite sur `tasks.md`
issu de cette planification (`/speckit.analyze` avant Implement).

## Phase 1 — Fondation backend

- `apps/api/prisma/schema.prisma` : ajout `model UserPermission` (control-plane,
  cf. `spec.md`), migration Prisma.
- `apps/api/src/permissions/` (nouveau module) :
  - `permissions.constants.ts` — catalogue fermé des permissions (`PERMISSIONS_CONNUES`)
    et matrice par défaut rôle → permission (✅/❌), reprise de `spec.md`.
  - `permissions.service.ts` — `getEffectivePermissions(tenantId, userId)` :
    charge les overrides `UserPermission` du tenant/utilisateur, applique la
    priorité DENY > ALLOW > défaut du rôle.
  - `permissions.guard.ts` + `permission.decorator.ts` (`@RequirePermission(...)`) —
    miroir exact de `licence-active.guard.ts` (Reflector + lookup service async).
- `apps/api/src/auth/types.ts` : pas de champ `permissions` porté sur le JWT
  (permissions résolues à la demande par le guard depuis la DB, comme le rôle
  est déjà revalidé à chaque requête dans `jwt.strategy.ts` — évite un token
  à re-signer à chaque changement de permission).
- Tests unitaires `permissions.service.spec.ts` : toutes combinaisons
  rôle × permission × override (ALLOW seul, DENY seul, aucun override, DENY
  qui prime sur ALLOW simultané impossible par contrainte `@@unique`).

## Phase 2 — Dette d'audit (indépendante, peut démarrer en parallèle de la Phase 1)

- `apps/api/src/users/users.service.ts` : injection `AuditService`, appel
  sur `create()`, `update()` (changement de rôle et/ou `actif`),
  `resetMotDePasse()`. `entityType = 'User'`, `metadata` = anciennes/nouvelles
  valeurs pertinentes uniquement (jamais le hash de mot de passe).
- Extension des tests d'intégration `users.integration.spec.ts` existants :
  vérifier la présence d'une entrée `AuditLog` après chaque mutation.

## Phase 3 — Endpoints + intégration

- `apps/api/src/permissions/permissions.controller.ts` (`@Roles(Role.ADMIN)`) :
  - `GET /utilisateurs/:id/permissions` — overrides actuels + défauts du rôle.
  - `PUT /utilisateurs/:id/permissions/:permission` (`{ effet: 'ALLOW'|'DENY'|null }`,
    `null` = suppression de l'override, retour au défaut du rôle).
  - Tenant-scopé via le même pattern `findFirst({ id, tenantId })` que
    `UsersService.update()`. Journalise chaque changement via `AuditService`
    (Phase 2).
- Application progressive de `@RequirePermission(...)` en complément (jamais
  en remplacement) des `@Roles(...)` déjà en place sur `services`, `clients`,
  `orders`, `cash`, `stocks`, `tickets`, `reports` — un seul contrôleur à la
  fois, avec `security.integration.spec.ts` vert entre chaque.
- Nouveaux tests cross-tenant dédiés `UserPermission` (GET/PUT/ID forgé/JWT
  incorrect) dans `security.integration.spec.ts`.
- Extension du bloc `permissions RBAC (§21.3, consolidé)` avec des cas
  ALLOW/DENY explicites (pas seulement rôle refusé).

## Phase 4 — UI web

- `apps/web/src/pages/UsersPage.tsx` : bouton "Permissions" par ligne
  (visible seulement pour CAISSIER/TECHNICIEN/LIVREUR — inutile pour ADMIN,
  qui a tout par défaut et rien de configurable).
- Nouvel écran/modale `PermissionsPage.tsx` (ou composant intégré) : cases à
  cocher par domaine, héritées grisées non éditables, overrides ⚙ éditables,
  badge "Personnalisé".
- `apps/web/src/lib/types.ts` : type des permissions effectives si nécessaire
  côté client pour du masquage UX (jamais une autorité).
- Tests composant (`PermissionsPage.test.tsx`) + test E2E masquage/appel
  direct refusé.

## Phase 5 — Documentation

- `docs/architecture/architecture.md` : section modèle d'autorisation.
- `docs/cahier-des-charges.md` §2 : formaliser la notion déjà anticipée
  ("permissions définies", "autorisées").
- `.specify/memory/constitution.md` : principe permissions granulaires, si
  jugé structurant par le propriétaire produit à ce stade.
- `packages/shared-types/src/index.ts` : type `Permission` partagé si besoin
  réel côté web/mobile (mobile n'affiche rien de configurable, cf. Phase 4 —
  à confirmer si un type partagé est vraiment nécessaire ou si `string`
  suffit côté API).

## Ordre et dépendances

Phase 1 bloque Phase 3 (le guard a besoin du modèle et du service). Phase 2
est indépendante et peut être livrée en premier ou en parallèle. Phase 4
dépend de Phase 3 (endpoints). Phase 5 clôture après Phase 4.

## Risques identifiés (repris du rapport d'audit)

- Confusion rôle vs permission si `@Roles` et `@RequirePermission` ne sont
  pas clairement documentés comme un ET logique (pas un OU, pas un
  remplacement implicite).
- Catalogue de permissions non validé côté serveur → à bloquer dès le DTO
  (`@IsIn(PERMISSIONS_CONNUES)`).
- Régression sur les routes déjà `@Roles`-protégées lors de l'ajout
  progressif de `@RequirePermission` — chaque contrôleur migré isolément,
  suite de sécurité vérifiée à chaque étape.
