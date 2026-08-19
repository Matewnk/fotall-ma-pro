# Customers — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Customers** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

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

- `Client` (schéma tenant-scoped, `prisma/tenant/schema.prisma`) : nom, téléphone (obligatoire),
  email, adresse, canal de notification préféré, statut, notes, timestamps. Première entité
  métier tenant-scoped du projet.
- `TenantSchemaProvisioner` généralisé : applique désormais **toutes** les migrations
  tenant-scoped dans l'ordre chronologique (au lieu d'une seule codée en dur) — nécessaire dès
  qu'une deuxième migration tenant existe.
- CRUD + recherche par nom/téléphone (`contains`, insensible à la casse) ; export CSV
  tenant-scoped.
- `ADMIN` et `CAISSIER` uniquement (`@Roles`) — les deux rôles explicitement liés à la gestion
  des clients dans le cahier des charges §2.1.
- **Premier usage réel de `LicenceActiveGuard`** (construit en 004, jamais branché faute
  d'écriture métier) : `@RequireActiveLicence()` sur create/update/delete. Les lectures (get,
  list, export) restent disponibles même licence bloquée (§13.4).

## Écarts comblés (documentés depuis 003 et 004)

- **Export cross-tenant** (matrice d'isolation, 003) : désormais testé en conditions réelles —
  l'export d'un tenant ne contient jamais les données d'un autre.
- **Écriture bloquée par licence** (004) : désormais testé en conditions réelles — une licence
  `SUSPENDUE` bloque `POST /clients`, la lecture reste disponible.

Ces deux items n'étaient pas des trous silencieux : ils étaient explicitement listés comme
différés dans `specs/003-tenant-isolation/spec.md` et `specs/004-licensing/spec.md`, faute
d'écriture métier existante à l'époque pour les exercer.

## Périmètre différé

- « Historique des commandes » et « historique des notifications » (cahier des charges §5.2) :
  les entités `Commande` (009) et `Notification` (012) n'existent pas encore.

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec.
- [x] Tests unitaires (`clients.service.spec.ts`).
- [x] Tests intégration réels contre PostgreSQL (`clients.integration.spec.ts`, job CI
      `integration`) : validation, CRUD, recherche, export, écriture bloquée.
- [x] Tests sécurité/RBAC (TECHNICIEN/LIVREUR → 403, écriture bloquée par licence).
- [x] Tests tenant isolation (GET/LIST/UPDATE/DELETE/export cross-tenant, via HTTP réel).
- [x] Documentation mise à jour (cette spec, `specs/003-tenant-isolation/spec.md` et
      `specs/004-licensing/spec.md` référencées pour les écarts comblés).
