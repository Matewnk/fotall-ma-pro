# SPEC 016 — 016-MOBILE-OFFLINE

Applique le workflow Spec Kit :
READ → SPECIFY → CLARIFY → PLAN → CHECKLIST → TASKS → ANALYZE → IMPLEMENT →
TEST → REVIEW → CONVERGE → COMMIT → PR → MERGE.

Avant modification, indique la spec active, les fichiers attendus, les ambiguïtés
et l'impact tenant/sécurité.

## Mission
Construis React Native+Expo avec SQLite/WatermelonDB. Offline-first commandes/caisse/statuts/clients synchronisés. Queue persistante, retry, UUID, ID temporaire→serveur. Conflits : caisse addition, statut plus avancé, client fusion champ par champ, commande = résolution ID. Documente `docs/sync-conflict-strategy.md` et teste coupures/réordonnancement.

## Règles
- respecte `CLAUDE.md` et les documents de référence ;
- ne déborde pas sur les specs futures ;
- ne change pas l'architecture sans décision/ADR ;
- ajoute les tests pertinents ;
- ne déclare pas la spec terminée avec des tests échoués ;
- termine par le résumé, tests, risques, décisions et `git status`.
