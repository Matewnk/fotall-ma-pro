# Onboarding — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Onboarding** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

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

- `OnboardingState` (control-plane, 1:1 Tenant) : `etape_courante` (`IDENTITE → TARIFS →
UTILISATEUR_NOTIFICATION → TERMINE`), un timestamp par étape complétée, jamais de régression
  d'étape (rappeler une étape déjà dépassée met à jour les données sans reculer
  `etape_courante`).
- Créé automatiquement à l'inscription (`AuthService.register` → `OnboardingService.initier`,
  même transaction control-plane que Tenant/User/Licence).
- `POST /onboarding/etape-1` : identité (nom, logo, adresse, téléphone, devise, langue — tous
  optionnels, seuls les champs fournis sont mis à jour sur `Tenant`).
- `POST /onboarding/etape-2` : choix `CATALOGUE_STANDARD` ou `GRILLE_VIERGE`, stocké tel quel (voir
  périmètre différé ci-dessous).
- `POST /onboarding/etape-3` : canal de notification préféré + émission de l'événement
  `onboarding.notification.test` (même schéma que `licence.essai.bientot_expire` : le domaine
  métier n'appelle jamais directement un fournisseur FCM/WhatsApp/SMS).
- `GET /onboarding/etat` : permet la reprise à tout moment.
- Réservé à `ADMIN` (RolesGuard) — CAISSIER/TECHNICIEN/LIVREUR n'ont pas à piloter l'onboarding.
- **Ne bloque jamais l'usage normal** : aucun guard ailleurs dans l'application ne dépend de
  l'état d'onboarding, vérifié explicitement par le test d'intégration (accès à `/audit` pendant
  un onboarding incomplet).

## Périmètre différé

- ~~Le choix `CATALOGUE_STANDARD` / `GRILLE_VIERGE` est stocké, mais aucun catalogue de services
  n'est réellement créé~~ — **résolu par la spec 008-services** : `completerEtape2` sème
  désormais réellement les 10 codes de référence quand le tenant choisit `CATALOGUE_STANDARD`.
- `logoUrl` est un simple champ texte (URL) : aucun système d'upload/stockage de fichiers n'existe
  encore (specs 011/014+).
- Le « test de notification » (étape 3) n'envoie rien réellement : écouté par un listener qui
  journalise seulement, en attendant le module Notifications (012), même schéma que 004.

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec.
- [x] Tests unitaires (`onboarding.service.spec.ts` — 6 tests, dont abandon/reprise et
      non-régression d'étape).
- [x] Tests intégration réels contre PostgreSQL (`onboarding.integration.spec.ts`, job CI
      `integration`).
- [x] Tests sécurité/RBAC (JWT requis ; réservé à ADMIN via RolesGuard).
- [x] Tests tenant isolation : sans objet direct (control-plane, une ligne par tenant via clé
      unique `tenant_id`).
- [x] Documentation mise à jour (cette spec).
