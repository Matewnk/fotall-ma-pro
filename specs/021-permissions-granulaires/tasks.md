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
- [ ] T3.5 — Extension bloc `permissions RBAC (§21.3, consolidé)` avec cas
      ALLOW/DENY explicites.

## Phase 4 — UI web

- [ ] T4.1 — Bouton "Permissions" dans `UsersPage.tsx`.
- [ ] T4.2 — Écran/modale `PermissionsPage.tsx` (cases à cocher par domaine,
      héritées grisées, overrides éditables, badge "Personnalisé").
- [ ] T4.3 — Tests composant + E2E (masquage, appel direct refusé par le backend).

## Phase 5 — Documentation

- [ ] T5.1 — `docs/architecture/architecture.md` (section modèle d'autorisation).
- [ ] T5.2 — `docs/cahier-des-charges.md` §2 (formalisation).
- [ ] T5.3 — `.specify/memory/constitution.md` (si jugé structurant — à confirmer).
- [ ] T5.4 — `packages/shared-types` (type `Permission`, si besoin confirmé).

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
