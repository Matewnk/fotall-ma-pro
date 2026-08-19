# SPEC 018 — 018-AUDIT-SECURITY

Applique le workflow Spec Kit :
READ → SPECIFY → CLARIFY → PLAN → CHECKLIST → TASKS → ANALYZE → IMPLEMENT →
TEST → REVIEW → CONVERGE → COMMIT → PR → MERGE.

Avant modification, indique la spec active, les fichiers attendus, les ambiguïtés
et l'impact tenant/sécurité.

## Mission

Durcis audit, request ID, tenant context, RBAC, HTTPS, sessions, chiffrement, logs sans secrets, monitoring, alerting et quotas. Fais un audit cross-tenant complet et corrige les findings critiques/hauts avant validation, sauf décision humaine explicite.

## Règles

- respecte `CLAUDE.md` et les documents de référence ;
- ne déborde pas sur les specs futures ;
- ne change pas l'architecture sans décision/ADR ;
- ajoute les tests pertinents ;
- ne déclare pas la spec terminée avec des tests échoués ;
- termine par le résumé, tests, risques, décisions et `git status`.
