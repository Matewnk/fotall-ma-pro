# Tickets & Printing — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Tickets & Printing** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

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

## Critères d’acceptation

- [ ] Fonctionnalité conforme à la spec.
- [ ] Tests unitaires.
- [ ] Tests intégration.
- [ ] Tests sécurité/RBAC.
- [ ] Tests tenant isolation si applicable.
- [ ] Documentation mise à jour.
