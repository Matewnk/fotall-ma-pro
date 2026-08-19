# SPEC 017 — 017-BILLING

Applique le workflow Spec Kit :
READ → SPECIFY → CLARIFY → PLAN → CHECKLIST → TASKS → ANALYZE → IMPLEMENT →
TEST → REVIEW → CONVERGE → COMMIT → PR → MERGE.

Avant modification, indique la spec active, les fichiers attendus, les ambiguïtés
et l'impact tenant/sécurité.

## Mission

Intègre Stripe ou Mobile Money approuvé : souscription, renouvellement, changement plan, succès, échec, relances, suspension progressive et webhooks. Webhooks authentifiés, idempotents, tenant-scoped et résistants aux doublons/hors-ordre.

## Règles

- respecte `CLAUDE.md` et les documents de référence ;
- ne déborde pas sur les specs futures ;
- ne change pas l'architecture sans décision/ADR ;
- ajoute les tests pertinents ;
- ne déclare pas la spec terminée avec des tests échoués ;
- termine par le résumé, tests, risques, décisions et `git status`.
