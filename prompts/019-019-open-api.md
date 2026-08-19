# SPEC 019 — 019-OPEN-API

Applique le workflow Spec Kit :
READ → SPECIFY → CLARIFY → PLAN → CHECKLIST → TASKS → ANALYZE → IMPLEMENT →
TEST → REVIEW → CONVERGE → COMMIT → PR → MERGE.

Avant modification, indique la spec active, les fichiers attendus, les ambiguïtés
et l'impact tenant/sécurité.

## Mission

Implémente REST/OpenAPI pour clients, commandes, caisse/paiements et rapports. API keys tenant-bound, scopes, révocation, quotas par plan, webhooks et audit. Prouve qu'une clé d'un tenant ne voit jamais un autre tenant.

## Règles

- respecte `CLAUDE.md` et les documents de référence ;
- ne déborde pas sur les specs futures ;
- ne change pas l'architecture sans décision/ADR ;
- ajoute les tests pertinents ;
- ne déclare pas la spec terminée avec des tests échoués ;
- termine par le résumé, tests, risques, décisions et `git status`.
