# Tenant Isolation — Fotall-Ma Pro

> **RELEASE BLOCKER:** Oui.

## Objectif

Définir et implémenter la fonctionnalité **Tenant Isolation** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

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

- Isolation **physique** par schéma PostgreSQL dédié par tenant (`tenant_<uuid sans tirets>`),
  conformément à l'ADR-001 (pas de RLS en V1).
- `TenantSchemaProvisioner` : crée le schéma + applique la migration tenant-scoped à la création
  du tenant (`AuthService.register`), avec rollback compensatoire du Tenant/User control-plane si
  le provisioning échoue.
- `TenantPrismaFactory` : un `PrismaClient` par tenant, dont la chaîne de connexion fixe le schéma
  cible via le paramètre `schema`. Aucune requête ne peut physiquement voir les lignes d'un autre
  schéma — l'isolation ne dépend pas d'un filtre applicatif `WHERE tenantId = ...` qu'on pourrait
  oublier.
- Première entité tenant-scoped : `AuditLog` (`packages/api/src/audit`), qui sert à la fois de
  preuve du mécanisme et de brique de traçabilité (Constitution VII). Les futures entités métier
  (007+) réutiliseront le même `TenantPrismaFactory`.
- Le `tenant_id` n'est **jamais** lu depuis le corps, la query ou l'URL d'une requête cliente : il
  vient uniquement du `TenantContext` vérifié en base à chaque requête (spec 002). Le
  `ValidationPipe` global (`whitelist` + `forbidNonWhitelisted`) rejette toute tentative d'injecter
  un `tenantId` dans un DTO.

## Périmètre couvert vs différé

Couvert et prouvé par des tests d'intégration réels contre PostgreSQL (voir
`src/tenancy/tenant-isolation.integration.spec.ts`, job CI dédié `tenant-isolation`) :
GET direct par ID, LIST, SEARCH, UPDATE, DELETE, tenant_id falsifié dans le JWT, requête sans JWT,
tenant_id injecté côté client (DTO).

**Différé, documenté explicitement — ni caché ni oublié :**

- **Cache** : aucun Redis n'est encore branché nulle part dans le code. L'implémenter maintenant
  pour cocher une case serait prématuré (YAGNI) ; la convention `tenant:{tenant_id}:...` du cahier
  des charges §15.4 s'appliquera dès qu'un premier cas d'usage cache apparaîtra.
- **Queue/jobs** : aucune queue n'est implémentée (viendra avec les notifications, spec 012, ou les
  exports asynchrones, spec 014). Le test cross-tenant obligatoire sera écrit à ce moment-là.
- **Fichiers** : aucun stockage de fichiers n'existe encore (tickets 011, exports 014, logos).
- **Clés API** : système non implémenté — spec 019 (Open API), qui portera son propre test
  d'isolation obligatoire.
- **Exports/rapports** : specs 014+.

Ce report est une décision assumée (cf. échange avec l'utilisateur), pas un relâchement du
release blocker : chacun de ces sous-systèmes portera son test cross-tenant obligatoire au moment
de son introduction, comme l'exige `docs/testing/test-strategy.md` §Release blockers.

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec (mécanisme physique par schéma, périmètre ci-dessus).
- [x] Tests unitaires (via 002 : JwtStrategy, RolesGuard couvrent déjà la vérification
      d'appartenance).
- [x] Tests intégration réels contre PostgreSQL (job CI `tenant-isolation`, pas de mock).
- [x] Tests sécurité/RBAC (JWT falsifié, requête sans JWT, tenant_id falsifié).
- [x] Tests tenant isolation (GET/LIST/SEARCH/UPDATE/DELETE cross-tenant — voir périmètre
      ci-dessus pour cache/queue/fichiers/API keys/exports, différés et documentés).
- [x] Documentation mise à jour (`docs/security/tenant-isolation.md`, cette spec).
