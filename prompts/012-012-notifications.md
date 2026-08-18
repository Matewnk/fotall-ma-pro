# SPEC 012 — 012-NOTIFICATIONS

Applique le workflow Spec Kit :
READ → SPECIFY → CLARIFY → PLAN → CHECKLIST → TASKS → ANALYZE → IMPLEMENT →
TEST → REVIEW → CONVERGE → COMMIT → PR → MERGE.

Avant modification, indique la spec active, les fichiers attendus, les ambiguïtés
et l'impact tenant/sécurité.

## Mission
Construis l'architecture événementielle notifications : FCM, WhatsApp Business, SMS. Événements dépôt, prêt, livraison, retard, paiement, essai proche. Templates par tenant et dry-run. Tester retries, idempotence et isolation.

## Règles
- respecte `CLAUDE.md` et les documents de référence ;
- ne déborde pas sur les specs futures ;
- ne change pas l'architecture sans décision/ADR ;
- ajoute les tests pertinents ;
- ne déclare pas la spec terminée avec des tests échoués ;
- termine par le résumé, tests, risques, décisions et `git status`.
