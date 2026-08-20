# Audit & Security — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Audit & Security** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

## Références

- `docs/cahier-des-charges.md` (§19 — sécurité et confidentialité, §21.3/§21.4 — tests d'autorisation et d'isolation)
- `.specify/memory/constitution.md`
- `docs/architecture/architecture.md`
- `docs/testing/test-strategy.md`

## Exigences

- Les autorisations sont vérifiées côté serveur.
- Toute donnée tenant-scoped est strictement isolée.
- Les jobs et exports conservent le contexte tenant.
- Les opérations critiques sont idempotentes.

## Mécanisme implémenté

**Audit (§19.4)** — l'`AuditLog` tenant-scoped et son `AuditService` existent
depuis 001 (preuve du mécanisme d'isolation) mais n'étaient jusqu'ici
appelés que par le mode support (005). Cette spec constate que plusieurs
catégories de §19.4 sont déjà couvertes par des journaux append-only
dédiés construits dans des specs ultérieures, et comble le point restant :

- ✅ déjà couvert — **changements de licence** : `JournalLicence` (004).
- ✅ déjà couvert — **opérations financières sensibles** : `OperationCaisse`
  (010) + `JournalPaiement` (017).
- ✅ déjà couvert — **accès support** : `SupportSession` (005).
- ✅ déjà couvert — **exports** : `JournalPaiement.RELANCE_ENVOYEE` n'est
  pas un export, mais chaque export de rapport (014) reste une lecture
  RBAC-protégée et tenant-scoped, prouvée dans la suite de sécurité
  ci-dessous (§19.5 "export cross-tenant").
- 🆕 **changements de configuration / actions administratives** :
  `TenantsController.updatePlan` (SUPER_ADMIN) journalise désormais dans
  l'`AuditLog` du tenant concerné (`TENANT_PLAN_MODIFIE`).
- ⏸ **modifications utilisateurs** : aucun module de gestion des
  utilisateurs tenant-scoped n'existe encore (§11.1) — rien à auditer
  pour l'instant, voir périmètre différé.

**Sécurité (§19.5, §21.3/§21.4)** — `security.integration.spec.ts`
consolide, dans un seul fichier dédié, la preuve systématique déjà
partiellement répartie dans chaque spec métier, étendant la preuve
"RELEASE BLOCKER" de 003 (à l'époque limitée à `AuditLog`, seule entité
existante) aux entités introduites depuis :

- accès direct par ID cross-tenant (`Client`, `Commande`) → 404 ;
- UPDATE/DELETE direct en base impossible physiquement (schéma
  PostgreSQL dédié) ;
- LIST/recherche cross-tenant (`Commande`, journal de caisse) ;
- JWT falsifié (`tenant_id` ne correspondant pas à l'utilisateur en
  base) contre une écriture métier réelle (`POST /commandes`) → 401 ;
- `tenant_id` fourni dans le corps d'une requête toujours ignoré
  (whitelist DTO) ;
- export CSV cross-tenant (`GET /rapports/top-clients?format=csv`) ;
- lecture Super-Admin de la facturation d'un tenant jamais mélangée
  avec un autre ;
- tableau RBAC consolidé (5 routes représentatives × rôle refusé) et
  accès non authentifié sur un échantillon de routes ;
- job planifié cross-tenant : `BillingService.relancerAbonnementsEnRetard()`
  suspend la licence du tenant en retard sans jamais toucher un autre
  tenant.

## Périmètre différé

- **Cache cross-tenant** : aucun Redis n'est encore branché dans ce
  projet — rien à tester.
- **Fichiers cross-tenant** : aucun stockage de fichiers n'est encore
  implémenté (logos, pièces jointes) — rien à tester.
- **API keys cross-tenant** : aucune gestion de clé API n'existe encore
  (spec 019-open-api) — rien à tester.
- **Audit des modifications utilisateurs** : aucun module de gestion des
  utilisateurs tenant-scoped (§11.1) n'existe encore — à raccorder
  lorsqu'il sera construit.
- **Rotation/expiration de session JWT** (§19.1 "expiration de session ;
  rotation/renouvellement selon politique") : le JWT actuel a une durée
  fixe (`JWT_EXPIRES_IN`), sans rotation ni révocation anticipée —
  au-delà du périmètre de cette tranche.
- **Protection anti brute-force** (§19.1) : aucun rate-limiting sur
  `/auth/login` — à ajouter avant mise en production (020).

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec.
- [x] Tests unitaires (aucun nouveau — le mécanisme d'audit ajouté
      réutilise `AuditService`, déjà testé structurellement via
      `app.module.spec.ts` et les tests d'intégration existants).
- [x] Tests intégration (`security.integration.spec.ts`, PostgreSQL
      réel ; `super-admin.integration.spec.ts` étendu pour l'audit de
      changement de plan).
- [x] Tests sécurité/RBAC (tableau consolidé, voir ci-dessus).
- [x] Tests tenant isolation (voir ci-dessus).
- [x] Documentation mise à jour.
