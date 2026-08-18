# SPEC 011 — 011-TICKETS-PRINTING

Applique le workflow Spec Kit :
READ → SPECIFY → CLARIFY → PLAN → CHECKLIST → TASKS → ANALYZE → IMPLEMENT →
TEST → REVIEW → CONVERGE → COMMIT → PR → MERGE.

Avant modification, indique la spec active, les fichiers attendus, les ambiguïtés
et l'impact tenant/sécurité.

## Mission
Implémente ticket avec identité pressing, numéro unique, QR/code-barres, client, articles, services, prix, total, date prévue et mentions. Support ESC/POS 58/80 mm, PDF et partage. Tester confidentialité tenant.

## Règles
- respecte `CLAUDE.md` et les documents de référence ;
- ne déborde pas sur les specs futures ;
- ne change pas l'architecture sans décision/ADR ;
- ajoute les tests pertinents ;
- ne déclare pas la spec terminée avec des tests échoués ;
- termine par le résumé, tests, risques, décisions et `git status`.
