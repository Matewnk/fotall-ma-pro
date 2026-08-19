# SPEC 004 — 004-LICENSING

Applique le workflow Spec Kit :
READ → SPECIFY → CLARIFY → PLAN → CHECKLIST → TASKS → ANALYZE → IMPLEMENT →
TEST → REVIEW → CONVERGE → COMMIT → PR → MERGE.

Avant modification, indique la spec active, les fichiers attendus, les ambiguïtés
et l'impact tenant/sécurité.

## Mission

Implémente licence avec essai FINAL de 15 jours, états ESSAI/ACTIVE/EXPIREE/SUSPENDUE, job automatique d'expiration, JournalLicence append-only, clé de licence, guards d'écriture, actions Super-Admin avec motif et idempotence, événement interne avant fin d'essai. Tests 15e/16e jour et permissions.

## Règles

- respecte `CLAUDE.md` et les documents de référence ;
- ne déborde pas sur les specs futures ;
- ne change pas l'architecture sans décision/ADR ;
- ajoute les tests pertinents ;
- ne déclare pas la spec terminée avec des tests échoués ;
- termine par le résumé, tests, risques, décisions et `git status`.
