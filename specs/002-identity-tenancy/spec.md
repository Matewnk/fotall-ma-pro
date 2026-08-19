# Identity & Tenancy — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Identity & Tenancy** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

## Références

- `docs/cahier-des-charges.md`
- `.specify/memory/constitution.md`
- `docs/architecture/architecture.md`
- `docs/testing/test-strategy.md`

## Exigences

- Les autorisations sont vérifiées côté serveur.
- Toute donnée tenant-scoped est strictement isolée.
- Les jobs et exports conservent le contexte tenant.
- Les opérations critiques sont idempotentes.

## Décisions de clarification

- Email unique **par tenant** (`@@unique([tenantId, email])`), pas globalement. Le login
  requiert `sousDomaine + email + motDePasse`.
- Création de tenant via un endpoint public `POST /auth/register` (Tenant + premier
  utilisateur ADMIN en une transaction). La création par le Super-Admin (005) reste
  possible en complément, hors périmètre de cette spec.
- `SUPER_ADMIN` a un `tenantId` nullable (périmètre plateforme, hors tenant) — sa
  création reste hors périmètre de cette spec (005-super-admin).
- JWT access-token seul (pas de refresh token) — durée configurable via `JWT_EXPIRES_IN`
  (défaut 12h). Réévaluer si un besoin de refresh apparaît (mobile offline, spec 016).

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec.
- [x] Tests unitaires (AuthService, JwtStrategy, RolesGuard — 16 tests).
- [ ] Tests intégration (nécessitent une base PostgreSQL réelle — reportés en
      003-tenant-isolation, qui met en place le control-plane PostgreSQL et les
      fixtures Tenant A/B).
- [x] Tests sécurité/RBAC (rejet mot de passe invalide, utilisateur désactivé,
      tenant_id/rôle désynchronisés du token — vérification d'appartenance en base
      à chaque requête, pas seulement via la signature JWT).
- [ ] Tests tenant isolation (hors périmètre — 003-tenant-isolation, RELEASE BLOCKER).
- [x] Documentation mise à jour (décisions de clarification ci-dessus).
