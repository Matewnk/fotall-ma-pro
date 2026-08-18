# SPEC 005 — 005-SUPER-ADMIN

Applique le workflow Spec Kit :
READ → SPECIFY → CLARIFY → PLAN → CHECKLIST → TASKS → ANALYZE → IMPLEMENT →
TEST → REVIEW → CONVERGE → COMMIT → PR → MERGE.

Avant modification, indique la spec active, les fichiers attendus, les ambiguïtés
et l'impact tenant/sécurité.

## Mission
Construis le back-office SUPER_ADMIN : tenants, plans, licences, abonnements, facturation globale, statistiques, quotas/usage, incidents et support. Accès détaillé tenant uniquement via support motivé et audité. ADMIN ne doit jamais accéder aux routes Super-Admin.

## Règles
- respecte `CLAUDE.md` et les documents de référence ;
- ne déborde pas sur les specs futures ;
- ne change pas l'architecture sans décision/ADR ;
- ajoute les tests pertinents ;
- ne déclare pas la spec terminée avec des tests échoués ;
- termine par le résumé, tests, risques, décisions et `git status`.
