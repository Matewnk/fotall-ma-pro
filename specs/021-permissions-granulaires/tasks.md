# Tasks — Permissions granulaires

Chaque tâche produit un commit atomique, testé, avant de passer à la
suivante. Aucune tâche de ce fichier n'est démarrée avant validation finale
de l'Analyze ci-dessous.

## Phase 1 — Fondation backend

- [x] T1.1 — `UserPermission` dans `schema.prisma` (control-plane) + migration.
- [x] T1.2 — `permissions.constants.ts` (catalogue fermé + matrice par défaut).
- [x] T1.3 — `permissions.service.ts#getPermissionsEffectives()` + tests unitaires
      (toutes combinaisons rôle × permission × override).
- [x] T1.4 — `permission.decorator.ts` (`@RequirePermission`) + `permissions.guard.ts`
      + test unitaire du guard (mock service).

## Phase 2 — Dette d'audit

- [x] T2.1 — `UsersService` branché sur `AuditService` (create/update/resetMotDePasse).
- [x] T2.2 — Extension `users.integration.spec.ts` : `AuditLog` vérifié après mutation.

## Phase 3 — Endpoints + intégration

- [x] T3.1 — `permissions.controller.ts` (`GET`/`PUT`/`DELETE` overrides,
      `@Roles(ADMIN)`, tenant-scopé, journalisé via `AuditService`).
- [x] T3.2 — Tests cross-tenant dédiés `UserPermission`
      (`permissions.integration.spec.ts`, 9 cas incluant les 5 scénarios
      d'attaque du rapport d'audit).
- [x] T3.3 — Migration `@RequirePermission` sur `services.controller.ts` (premier
      contrôleur pilote) + suite de sécurité verte.
- [x] T3.4 — Migration `@RequirePermission` sur `clients`, `orders`, `cash`,
      `stocks`, `tickets`, `reports`. 3 endpoints laissés en `@Roles` seul
      (voir spec.md, point 9) : `OrdersController#updateStatut`,
      `CashController#enregistrer`, distinction reports.read/export —
      chacun sert plusieurs permissions via un seul endpoint, décision de
      conception différée.
- [x] T3.5 — Extension bloc `permissions RBAC (§21.3, consolidé)` avec cas
      ALLOW/DENY explicites (`clients.delete` ALLOW, `clients.create` DENY).

## Phase 4 — UI web

- [x] T4.1 — Bouton "Permissions" dans `UsersPage.tsx` (masqué pour ADMIN).
- [x] T4.2 — Panneau `PermissionsPanel` intégré à `UsersPage.tsx` (cases à
      cocher par domaine, sauvegarde immédiate par case plutôt qu'un bouton
      "Enregistrer" séparé — simplification volontaire, cf. commentaire en
      tête de composant), badge "Personnalisé" + réinitialisation par
      permission.
- [x] T4.3 — Tests composant (`UsersPage.test.tsx` : ouverture du panneau,
      toggle ALLOW, masquage pour ADMIN). Pas de E2E navigateur dédié : le
      refus backend est déjà prouvé par `permissions.integration.spec.ts`
      (T3.2) et `security.integration.spec.ts` (T3.5).

## Phase 5 — Documentation

- [x] T5.1 — `docs/architecture/architecture.md` (section "Autorisation :
      rôles + permissions granulaires (021)").
- [x] T5.2 — `docs/cahier-des-charges.md` — nouveau §2.3 "Permissions
      granulaires (021)", formalisant les mentions déjà présentes en §2.1.
- [x] T5.3 — `.specify/memory/constitution.md` — Principe II étendu (une
      phrase, cohérent avec le style terse existant) : jugé structurant,
      c'est une extension du modèle d'autorisation central.
- [x] T5.4 (non fait, volontairement) — pas de type `Permission` partagé
      dans `packages/shared-types` : mobile n'a aucun écran de gestion des
      permissions (Option A), le web a son propre catalogue d'affichage
      (`apps/web/src/lib/permissions.ts`), rien à partager réellement entre
      plateformes pour l'instant.

## Analyze — vérification de cohérence

- Cohérence avec la Constitution : aucun conflit détecté. Isolation
  multi-tenant préservée (pattern `findFirst({id, tenantId})` répliqué),
  RBAC serveur préservé (le frontend ne devient jamais une autorité,
  cf. §2.2 cahier des charges), pas de suppression/écrasement silencieux
  (append-only via `AuditLog`).
- Cohérence avec le cahier des charges : formalise une notion déjà présente
  textuellement (§2 — "permissions définies", "opérations autorisées").
- Risque de sur-ingénierie : écarté — pas de `RolePermission` en base (les
  défauts du rôle restent codés en dur, versionnés), pas de type `Permission`
  partagé tant que le besoin mobile n'est pas confirmé (T5.4 conditionnelle).
- Aucune dépendance externe nouvelle, aucun changement de stack.
- `/speckit.analyze` : validé sur cette base — prêt pour Implement sous
  réserve du feu vert explicite du propriétaire produit sur ce fichier.
