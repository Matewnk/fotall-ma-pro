# SPEC 020 — 020-PRODUCTION

Applique le workflow Spec Kit :
READ → SPECIFY → CLARIFY → PLAN → CHECKLIST → TASKS → ANALYZE → IMPLEMENT →
TEST → REVIEW → CONVERGE → COMMIT → PR → MERGE.

Avant modification, indique la spec active, les fichiers attendus, les ambiguïtés
et l'impact tenant/sécurité.

## Mission
Prépare production : Docker, CI/CD, migrations, secrets, backups quotidiens, restauration tenant par tenant, monitoring, alerting, logs, quotas, déploiement API/Web et publication mobile. Fais la recette finale de toutes les exigences. Aucun release blocker ne doit rester.

## Règles
- respecte `CLAUDE.md` et les documents de référence ;
- ne déborde pas sur les specs futures ;
- ne change pas l'architecture sans décision/ADR ;
- ajoute les tests pertinents ;
- ne déclare pas la spec terminée avec des tests échoués ;
- termine par le résumé, tests, risques, décisions et `git status`.
