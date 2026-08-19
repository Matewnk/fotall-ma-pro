# Super Admin — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Super Admin** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

## Références

- `docs/cahier-des-charges.md`
- `.specify/memory/constitution.md`
- `docs/architecture/architecture.md`
- `docs/testing/test-strategy.md`

## Exigences

- Les autorisations sont vérifiées côté serveur.
- Toute donnée tenant-scoped est strictement isolée.
- Les jobs et exports conservent le contexte tenant.
- Les opérations critiques sont idempotentes.

## Mécanisme implémenté

- `SUPER_ADMIN` distinct d'`ADMIN` : aucun accès direct aux données d'un tenant, seulement via un
  mode support explicite. Pas de « super ADMIN » qui serait juste un ADMIN avec plus de droits.
- `TenantsController` (`/super-admin/tenants`) : liste, détail, mise à jour du plan commercial —
  uniquement des données control-plane (nom, sous-domaine, plan, statut de licence), jamais de
  données métier détaillées.
- `StatsController` (`/super-admin/stats`) : statistiques globales (nombre de tenants, répartition
  par statut de licence).
- Mode support (`SupportSessionController`, cahier des charges §16) :
  - `POST /super-admin/tenants/:id/support/demarrer` — motif obligatoire (validation DTO), crée la
    session (**l'audit de début EST la création de la ligne** : `started_at`, `motif`,
    `super_admin_id`, `tenant_id`).
  - `POST .../terminer` — clôture la session (**l'audit de fin EST `ended_at`**), idempotent.
  - `GET .../session` — état courant (pour un futur bandeau UI, spec 015-web).
  - `GET .../audit` — accès aux données détaillées (le journal d'audit tenant-scoped), protégé par
    `SupportSessionGuard` : refusé (403) sans session active.
  - Une seule session active à la fois par (tenant, super-admin) : `ConflictException` (409) sur
    tentative de doublon.
  - Expiration automatique après 4h sans clôture explicite (filet de sécurité, décision
    d'ingénierie documentée dans `support-session.service.ts` — aucune politique de durée n'est
    spécifiée dans le cahier des charges).
- Test de compilation du graphe DI (`app.module.spec.ts`) ajouté suite à un bug réel détecté en
  004 (`LicenceModule` ne résolvait pas `JwtService`, invisible en tests unitaires classiques) :
  attrape ce type d'erreur de câblage sans attendre le job CI avec Postgres.

## Périmètre différé

- Abonnements et facturation réelle : spec 017-billing. `plan` reste un simple champ texte sur
  `Tenant`, sans lien avec un cycle de facturation.
- Catalogue de plans avec quotas/tarifs : non modélisé, `PLANS` est une liste fermée minimale.
- Accès Super-Admin aux futures entités métier tenant-scoped (clients, commandes, caisse — 007+) :
  suivra le même schéma (`SupportSessionGuard` + route dédiée), à ajouter au fur et à mesure que
  ces entités existent. Seul `AuditLog` (003) est actuellement exposé via `/support/audit`.

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec.
- [x] Tests unitaires (`support-session.service.spec.ts`, `support-session.guard.spec.ts`,
      `app.module.spec.ts`).
- [x] Tests intégration réels contre PostgreSQL (`super-admin.integration.spec.ts`, job CI
      `integration`).
- [x] Tests sécurité/RBAC (ADMIN → 403 sur toutes les routes `/super-admin/*`, aucun accès sans
      session support active, motif obligatoire, une seule session concurrente).
- [x] Tests tenant isolation : sans objet direct (control-plane), la protection repose sur RBAC +
      mode support plutôt que sur l'isolation par schéma.
- [x] Documentation mise à jour (cette spec).
