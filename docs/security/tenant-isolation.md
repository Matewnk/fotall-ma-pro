# Tenant Isolation — Release Blocker

Avec Tenant A et Tenant B, tester : ID direct, liste, recherche, modification,
suppression, export, rapport, cache, queue, fichier, audit et API key.

Rejeter : JWT falsifié, tenant_id incohérent, job sans tenant_id, job cross-tenant,
support sans motif.

## Mécanisme (V1)

Isolation physique par **schéma PostgreSQL dédié par tenant** (`tenant_<uuid>`), pas par filtre
applicatif. Chaque tenant a son propre `PrismaClient` (`TenantPrismaFactory`), dont la chaîne de
connexion fixe le schéma cible : une requête ne peut physiquement pas voir les lignes d'un autre
schéma, même en cas d'oubli d'un filtre `WHERE tenantId = ...` côté code.

Le schéma est provisionné à la création du tenant (`TenantSchemaProvisioner`, appelé depuis
`AuthService.register`), avec rollback du Tenant/User control-plane si le provisioning échoue.

## État des preuves (spec 003)

Prouvé par des tests d'intégration réels contre PostgreSQL (`src/tenancy/tenant-isolation.integration.spec.ts`,
job CI `tenant-isolation`, service Postgres réel — pas de mock) : GET direct par ID, liste,
recherche, modification, suppression, tenant_id falsifié dans le JWT, requête sans JWT, tenant_id
injecté côté client.

Différé et documenté (aucun de ces sous-systèmes n'existe encore ailleurs dans le code — voir
`specs/003-tenant-isolation/spec.md` pour le détail et la justification) : cache, queue/jobs,
fichiers, clés API, exports/rapports. Chacun portera son propre test cross-tenant obligatoire au
moment de son introduction.
