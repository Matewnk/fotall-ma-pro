# Checklist — Subscriptions & Invoicing

## Phase 1 — Super-Admin (implémentée et testée)

- [x] Specify
- [x] Clarify (numérotation 023, pas de TVA/prorata inventés — voir spec.md)
- [x] Plan
- [x] Checklist
- [x] Tasks
- [x] Analyze
- [x] Implement
- [x] Tests verts (225 tests unitaires API, 37 tests d'intégration dont
      RBAC/isolation cross-tenant, 111 tests web)
- [x] Converge

## Phase 2 — Espace propriétaire, lecture seule (implémentée et testée)

- [x] Specify (voir spec.md, section "Phase 2 — Espace propriétaire")
- [x] Clarify (lecture seule décidée explicitement — aucune action
      d'écriture cette phase)
- [x] Plan
- [x] Checklist
- [x] Tasks
- [x] Analyze
- [x] Implement (permission `facturation.read`, routes tenant-scoped
      `/abonnement`, `/factures`, `/factures/:id`, `/factures/:id/pdf`,
      `/plans`, page `BillingSelfServicePage`)
- [x] Tests verts (4 tests d'intégration RBAC/cross-tenant/override +
      4 tests web loading/empty/filtres, 225 tests unitaires API et 115
      tests web au global sans régression)
- [x] Converge

## Aperçu de renouvellement (Phase 2, lecture seule — voir ADR-006)

- [x] Specify (voir spec.md, section "Aperçu de renouvellement")
- [x] Clarify (aucun appel réseau, bouton de confirmation désactivé —
      décision explicite, pas de backend touché)
- [x] Implement (3 niveaux actif/proche/expiré, modal 100% client dans
      `BillingSelfServicePage.tsx`)
- [x] Tests verts (4 nouveaux tests web : actif, proche, expiré, modal +
      aucun appel réseau au clic ; 119 tests web au global sans régression)
- [x] Converge

## Initiation de paiement PayTech, DRY_RUN uniquement (Phase 3 — voir ADR-007)

- [x] Specify (voir spec.md, section "Phase 3")
- [x] Clarify (backend isolé, UI Phase 2 inchangée — décision explicite)
- [x] Implement (`PaytechService` dry-run, `POST /factures/:id/renouvellement`,
      permission `facturation.renouveler`, audit `FACTURE_RENOUVELLEMENT_INITIE`)
- [x] Tests verts (3 tests unitaires `PaytechService` + 4 tests
      d'intégration : initiation + audit, refus facture payée/annulée,
      isolation cross-tenant, RBAC 403 par défaut ; 228 tests unitaires API
      et 185/187 tests d'intégration API verts — 2 échecs pré-existants et
      sans rapport dans `backup.integration.spec.ts`, `pg_dump` local)
- [x] Converge

## Renouvellement self-service depuis /facturation (Phase 4 — voir ADR-006, ADR-007)

- [x] Specify (voir spec.md, section "Phase 4")
- [x] Clarify (statut fusionné Abonnement+Licence, tarif = Abonnement.montant,
      facture comme ancre de paiement, confirmation DRY_RUN dev-only —
      décisions explicites, voir spec.md)
- [x] Plan (audit préalable : modèles/routes existants, ADR-006/007 —
      aucun nouveau modèle nécessaire)
- [x] Implement :
  - `GET /abonnement` étendu (`licence`)
  - `POST /abonnement/renouvellement` (remplace `POST /factures/:id/renouvellement`)
  - `POST /factures/:id/confirmer-dry-run` (dev-only)
  - `InvoicesService#creerPourRenouvellementTenant`
  - `BillingService#traiterEvenementPaiement` rétrocompatible (referenceProvider →
    durée réelle, sinon cycle fixe inchangé)
  - `BillingSelfServicePage.tsx` réécrite (badge fusionné, dates, limites, modal 3
    étapes, filtres factures étendus, historique paiements enrichi)
  - PDF facture : durée + référence de paiement ajoutées
- [x] Tests verts :
  - API unitaires : 230 (dont 3 nouveaux `PaytechService`, 2 nouveaux
    `BillingService` durée dérivée de facture)
  - API intégration : 11/11 `billing-self-service`, 186/188 au global (2 échecs
    pré-existants `backup.integration.spec.ts`, sans rapport)
  - Web : 124/124 (13 dans `BillingSelfServicePage.test.tsx`)
  - `pnpm typecheck`, `pnpm lint`, `pnpm build` : verts sur les 5 packages du
    monorepo
  - Vérifié en direct (curl) : initiation → confirmation DRY_RUN → facture
    PAYEE, Abonnement ACTIF, Licence prolongée en préservant le temps restant
- [x] Converge
