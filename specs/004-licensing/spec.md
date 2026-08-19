# Licensing — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Licensing** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

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

## Mécanisme implémenté

- Modèle control-plane `Licence` (1:1 avec `Tenant`, source de vérité unique du statut — le champ
  `Tenant.statutLicence` de 002 est retiré) + `JournalLicence` append-only.
- Machine à états stricte (`licence.constants.ts`) : `CREATION→ESSAI`, `ESSAI/EXPIREE→ACTIVE`
  (activation), `ACTIVE→ACTIVE` (renouvellement), `ACTIVE→SUSPENDUE`, `SUSPENDUE→ACTIVE`
  (réactivation), `{ESSAI,ACTIVE,SUSPENDUE}→EXPIREE` (révocation), `ESSAI→EXPIREE` (expiration
  automatique). Toute transition hors table → 409.
- `date_fin_essai = date_debut_essai + 15 jours`, calculée côté serveur à la création du tenant
  (`AuthService.register` → `LicenceService.creerEssai`, même transaction control-plane). Aucun
  champ de date n'est accepté depuis le client dans les DTO — impossible de la falsifier.
- Lecture faisant autorité (`GET /licence/statut`) : si l'essai est échu mais que le job planifié
  n'est pas encore passé, la transition `EXPIRATION_AUTOMATIQUE` est appliquée à la lecture même,
  jamais une valeur périmée servie.
- Idempotence par `idempotencyKey` obligatoire sur chaque action manuelle : un rejeu identique
  (même `licenceId` + `evenement` + `idempotencyKey`) ne crée pas de second événement de journal.
- Motif obligatoire (validation DTO) sur `suspendre` et `revoquer` (actions manuelles sensibles) ;
  optionnel sur `activer`/`renouveler`/`reactiver`.
- Rotation de `cle_licence_jwt` à chaque changement d'état.
- `LicenceActiveGuard` + `@RequireActiveLicence()` : mécanisme centralisé et testé, mais **non
  attaché à aucune route pour l'instant** — aucune écriture métier n'existe encore (customers,
  orders, cash arrivent en 007+). Chaque spec qui ajoute une écriture métier posera ce décorateur
  sur ses endpoints.
- Job planifié horaire (`@nestjs/schedule`) : expire les essais échus, émet l'événement
  `licence.essai.bientot_expire` (48h avant échéance, via `@nestjs/event-emitter`) — écouté pour
  l'instant par un listener qui journalise seulement (le branchement FCM/WhatsApp/SMS réel est le
  périmètre de la spec 012-notifications, cohérent avec l'architecture événementielle §8.3 : le
  domaine métier n'appelle jamais directement un fournisseur).

## Périmètre différé

- Endpoints Super-Admin de création de compte `SUPER_ADMIN` : spec 005. Pour les tests
  d'intégration de cette spec, un `SUPER_ADMIN` est créé directement via Prisma (pas d'API
  publique), ce qui est cohérent avec la décision de 002 (seul un ADMIN est créé via
  `/auth/register`).
- Politique exacte de facturation (durée de plan, montants) : spec 017-billing. `renouveler`
  accepte pour l'instant une durée en jours fournie par le Super-Admin, sans lien avec un plan
  commercial facturé.

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec.
- [x] Tests unitaires (`licence.service.spec.ts`, `licence-active.guard.spec.ts`).
- [x] Tests intégration réels contre PostgreSQL (`licence.integration.spec.ts`, job CI
      `integration`) : création→J+15, ADMIN→403, motif obligatoire, journal, idempotence, cycle de
      vie complet, expiration automatique à la lecture.
- [x] Tests sécurité/RBAC (ADMIN → 403 sur les routes Super-Admin).
- [x] Tests tenant isolation : sans objet ici (le control-plane n'est pas tenant-scoped par
      schéma ; chaque licence est déjà liée à un tenant unique par clé étrangère).
- [x] Documentation mise à jour (cette spec).
