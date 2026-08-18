# Fotall-Ma Pro

Application SaaS multi-tenant de gestion de pressing — Web, mobile et tablette.

## Documents de référence

- `docs/cahier-des-charges.md`
- `docs/instructions-claude-code-fotall-ma-pro.md`
- `.specify/memory/constitution.md`
- `docs/architecture/architecture.md`
- `docs/testing/test-strategy.md`
- `specs/`

## Règles non négociables

- Essai gratuit : **15 jours**, calculé côté serveur à la création du tenant.
- `SUPER_ADMIN` est distinct de `ADMIN` tenant.
- Isolation multi-tenant absolue : aucune fuite, modification, export ou déduction cross-tenant.
- Toute requête, job, cache, fichier, export et audit tenant-scoped doit porter un contexte tenant valide.
- Caisse append-only.
- Synchronisation offline idempotente.
- Autorisation côté serveur.

## Stack V1

- pnpm + Turborepo
- NestJS + TypeScript
- Prisma + PostgreSQL 16
- Redis
- React + Vite
- React Native + Expo
- REST + OpenAPI
- Docker + GitHub Actions

## Workflow Spec Kit

`constitution → specify → clarify → plan → checklist → tasks → analyze → implement → converge`

## Ordre de développement

`001 → 002 → 003 → 004 → ... → 020`

`003-tenant-isolation` est un **release blocker**.
