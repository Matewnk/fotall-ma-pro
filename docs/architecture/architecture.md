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
