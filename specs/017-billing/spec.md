# Billing — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Billing** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

## Références

- `docs/cahier-des-charges.md` (§13.6, §14 — plans commerciaux et facturation)
- `.specify/memory/constitution.md`
- `docs/architecture/architecture.md`
- `docs/testing/test-strategy.md`

## Exigences

- Les autorisations sont vérifiées côté serveur.
- Toute donnée tenant-scoped est strictement isolée.
- Les jobs et exports conservent le contexte tenant.
- Les opérations critiques sont idempotentes.

## Mécanisme implémenté

- **`Tenant.plan`** passe d'un texte libre (déjà contraint en application
  via `IsIn`) à un véritable enum Postgres `PlanCommercial` (`STARTER` /
  `PRO` / `BUSINESS`, §14) — même garantie désormais au niveau base.
- **`Abonnement`** (control-plane, 1:1 par tenant comme `Licence`, 004) :
  plan, mode de paiement, montant, devise, statut (`ACTIF` / `EN_RETARD`
  / `ANNULE`), date de prochaine facturation.
- **`JournalPaiement`** append-only (même principe que `JournalLicence`, 004) : chaque évènement de paiement (`PAIEMENT_REUSSI`,
  `PAIEMENT_ECHEC`, `RELANCE_ENVOYEE`) est journalisé, idempotent via une
  `idempotencyKey` unique (§14.1 : "événements de paiement idempotents").
- **`POST /super-admin/facturation/:tenantId/abonnement`** et
  **`GET /super-admin/facturation/:tenantId`** (SUPER_ADMIN uniquement,
  §13.6) : seul le Super-Administrateur provisionne un abonnement — la
  création active immédiatement la licence si elle n'est pas déjà
  `ACTIVE` (§14.1 : "en V1, le tenant ne modifie pas directement l'état
  de sa licence").
- **`POST /facturation/webhook`** : reçoit les évènements de paiement
  sous une forme normalisée indépendante du fournisseur, réconcilie
  l'état de la licence via `LicenceService` déjà existant (004) :
  - `PAIEMENT_REUSSI` depuis `ESSAI`/`EXPIREE` → `activer()` ;
  - `PAIEMENT_REUSSI` depuis `ACTIVE` → `renouveler()` ;
  - `PAIEMENT_REUSSI` depuis `SUSPENDUE` → `reactiver()` puis
    `renouveler()` ;
  - `PAIEMENT_ECHEC` → abonnement `EN_RETARD`, licence inchangée
    (délai de grâce, voir job planifié).
- **Job planifié** (`BillingScheduler`, horaire, même motif que
  `LicenceScheduler`) : relance les abonnements `EN_RETARD` (journal
  `RELANCE_ENVOYEE`, idempotent par jour) et suspend la licence
  au-delà de `JOURS_GRACE_AVANT_SUSPENSION` (7 jours, §13.3 : "la
  transition exacte entre expiration de période payée et suspension
  doit rester alignée avec le module de facturation").
- **Sécurité du webhook** : aucune credential Stripe/Mobile Money
  réelle n'existe dans ce projet (comme les adaptateurs FCM/WhatsApp/SMS
  de 012) — un secret partagé (`FACTURATION_WEBHOOK_SECRET`, en-tête
  `X-Webhook-Secret`) tient lieu de vérification de signature
  fournisseur, en échec fermé (fail-closed) si non configuré.

## Périmètre différé

- Aucune intégration réelle Stripe/Mobile Money (pas de SDK, pas
  d'appel sortant vers un fournisseur, pas de vérification de signature
  HMAC propre au fournisseur) — le webhook accepte une forme déjà
  normalisée ; une intégration réelle traduirait le payload propre au
  fournisseur vers cette même forme avant d'appeler
  `BillingService.traiterEvenementPaiement`.
- Pas de montants de référence par plan (§14 ne fixe aucun prix) : le
  montant est fourni explicitement par le SUPER_ADMIN à la création de
  l'abonnement plutôt qu'inventé.
- Délai de grâce avant suspension (7 jours) : valeur raisonnable
  documentée faute de politique commerciale explicite dans le cahier
  des charges — à ajuster si une politique différente est communiquée.
- Pas de génération de facture PDF/reçu (differe de 011-tickets et
  014-reports, qui pourraient être réutilisés plus tard).
- Pas d'auto-relance vers le tenant (email/SMS) : `RELANCE_ENVOYEE` est
  journalisée mais aucun événement n'est encore émis vers le module
  Notifications (012) — à raccorder dans une PR ultérieure de la même
  façon que licence.essai.bientot_expire.

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec.
- [x] Tests unitaires (`billing.service.spec.ts` : 16 tests ;
      `webhook-secret.guard.spec.ts` : 4 tests).
- [x] Tests intégration (`billing.integration.spec.ts`, PostgreSQL réel :
      provisionnement + activation de licence, webhook idempotent,
      PAIEMENT_ECHEC, secret invalide/absent, 404 sans abonnement,
      isolation cross-tenant).
- [x] Tests sécurité/RBAC (SUPER_ADMIN uniquement sur les routes
      `/super-admin/facturation/*`, ADMIN refusé ; webhook fail-closed
      sans secret correct).
- [x] Tests tenant isolation.
- [x] Documentation mise à jour.
