# SPEC 002 — 002-IDENTITY-TENANCY

Applique le workflow Spec Kit :
READ → SPECIFY → CLARIFY → PLAN → CHECKLIST → TASKS → ANALYZE → IMPLEMENT →
TEST → REVIEW → CONVERGE → COMMIT → PR → MERGE.

Avant modification, indique la spec active, les fichiers attendus, les ambiguïtés
et l'impact tenant/sécurité.

## Mission
Implémente Tenant, User, rôles tenant, SUPER_ADMIN, JWT, résolution tenant par login/sous-domaine, TenantContext, guards/interceptors et provisionnement du schéma PostgreSQL par tenant. Tests A/B cross-tenant obligatoires.

## Règles
- respecte `CLAUDE.md` et les documents de référence ;
- ne déborde pas sur les specs futures ;
- ne change pas l'architecture sans décision/ADR ;
- ajoute les tests pertinents ;
- ne déclare pas la spec terminée avec des tests échoués ;
- termine par le résumé, tests, risques, décisions et `git status`.
