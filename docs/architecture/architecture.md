# Architecture

## V1

- Monorepo pnpm + Turborepo
- API NestJS + TypeScript
- Prisma + PostgreSQL 16
- Schéma PostgreSQL dédié par tenant
- Redis pour cache/queues
- React/Vite Web
- React Native/Expo Mobile + tablette
- REST + OpenAPI
- Docker + GitHub Actions

## Tenant Context

```ts
type TenantContext = {
  tenantId: string;
  userId?: string;
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'CAISSIER' | 'TECHNICIEN' | 'LIVREUR';
  supportSessionId?: string;
};
```

Tout repository tenant-scoped exige ce contexte.

## Autorisation : rôles + permissions granulaires (021)

Deux couches, jamais fusionnées :

1. **Rôle** (`@Roles(...)` + `RolesGuard`) — filtre grossier par endpoint,
   inchangé (`SUPER_ADMIN`, `ADMIN`, `CAISSIER`, `TECHNICIEN`, `LIVREUR`).
2. **Permission effective** (`@RequirePermission(...)` + `PermissionsGuard`)
   — appliquée en ET logique avec le rôle, jamais en remplacement. Calculée
   à la demande (`PermissionsService`), jamais mise en cache dans le JWT :
   priorité stricte `DENY` explicite > `ALLOW` explicite > défaut du rôle
   (matrice codée en dur dans `permissions.constants.ts`, non stockée en
   base — seuls les écarts au défaut vivent dans `UserPermission`).

`users.manage` et `users.permissions` ne sont jamais accordables/révocables
par override : seul un `ADMIN` du tenant peut gérer les utilisateurs et
leurs permissions, sans exception configurable — anti élévation de
privilège déguisée.

Le masquage d'un bouton côté Web reste une convenance UX, jamais une
autorisation (§2.2 cahier des charges) : `PermissionsGuard` est la seule
autorité, y compris pour les 3 endpoints qui servent plusieurs permissions
conceptuelles via un unique handler (statut de commande, opérations de
caisse, export de rapports) — ceux-ci restent gouvernés par `@Roles` seul
en attendant une décision de conception sur leur découpage (voir
`specs/021-permissions-granulaires/spec.md`, point 9).

Détail complet (modèle de données, catalogue, matrice par rôle, UX,
scénarios d'attaque testés) : `specs/021-permissions-granulaires/spec.md`
et `docs/decisions/ADR-005-permissions-granulaires.md`.
