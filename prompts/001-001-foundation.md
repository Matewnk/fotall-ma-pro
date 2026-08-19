# SPEC 001 — 001-FOUNDATION

Applique le workflow Spec Kit :
READ → SPECIFY → CLARIFY → PLAN → CHECKLIST → TASKS → ANALYZE → IMPLEMENT →
TEST → REVIEW → CONVERGE → COMMIT → PR → MERGE.

Avant modification, indique la spec active, les fichiers attendus, les ambiguïtés
et l'impact tenant/sécurité.

## Mission

Établis le monorepo pnpm/Turborepo : apps/api NestJS+Prisma, apps/web React+Vite, apps/mobile Expo, packages/shared-types, Docker Postgres 16+Redis, TypeScript strict, ESLint/Prettier, CI GitHub Actions. Aucun métier. Vérifie install/build/lint/typecheck/tests.

## Règles

- respecte `CLAUDE.md` et les documents de référence ;
- ne déborde pas sur les specs futures ;
- ne change pas l'architecture sans décision/ADR ;
- ajoute les tests pertinents ;
- ne déclare pas la spec terminée avec des tests échoués ;
- termine par le résumé, tests, risques, décisions et `git status`.
