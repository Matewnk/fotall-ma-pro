# Checklist — Permissions granulaires

- [x] Specify
- [x] Clarify
- [x] Plan
- [x] Checklist
- [x] Tasks
- [x] Analyze
- [x] Implement (Phases 1-5, avec 3 endpoints laissés en `@Roles` seul —
      décision de conception différée, voir spec.md point 9)
- [x] Tests verts (backend : ~100 tests unitaires + intégration ; web : 82
      tests, suite complète ; 3 échecs pré-existants sans rapport dans
      `notifications.service.spec.ts`, confirmés identiques hors de cette
      spec)
- [x] Converge (mergé dans `main` via PR #37 le 2026-08-25 ; suivi restant :
      montée majeure NestJS 10→11 pour fermer GHSA-36xv-jgw5-4q75, cadrée
      séparément et non incluse dans cette spec — voir §21.3 du cahier des
      charges pour tout futur test RBAC/permission)
