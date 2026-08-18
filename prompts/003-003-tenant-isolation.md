# SPEC 003 — 003-TENANT-ISOLATION

Applique le workflow Spec Kit :
READ → SPECIFY → CLARIFY → PLAN → CHECKLIST → TASKS → ANALYZE → IMPLEMENT →
TEST → REVIEW → CONVERGE → COMMIT → PR → MERGE.

Avant modification, indique la spec active, les fichiers attendus, les ambiguïtés
et l'impact tenant/sécurité.

## Mission
RELEASE BLOCKER. Démontre l'isolation à l'API, DB, fichiers, cache, queues/jobs, notifications, exports/reports, API keys, audit et backups. Teste ID, LIST, SEARCH, UPDATE, DELETE, tenant_id falsifié, JWT incorrect et jobs cross-tenant. Un échec critique = STOP.

## Règles
- respecte `CLAUDE.md` et les documents de référence ;
- ne déborde pas sur les specs futures ;
- ne change pas l'architecture sans décision/ADR ;
- ajoute les tests pertinents ;
- ne déclare pas la spec terminée avec des tests échoués ;
- termine par le résumé, tests, risques, décisions et `git status`.
