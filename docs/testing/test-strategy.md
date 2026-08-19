# Stratégie de tests

## Unit

Licence, totaux, transitions, permissions, caisse, synchronisation, notifications.

## Integration

PostgreSQL, Prisma, Redis, queues, licence, billing, repositories.

## E2E

Tenant → onboarding → client → commande → ticket → paiement → traitement → notification → livraison → clôture → rapport.

## Security

Cross-tenant, RBAC, API keys, exports, fichiers, queues, cache.

## Release blockers

Toute fuite cross-tenant ou tout échec critique licence/RBAC/finance/offline bloque la release.
