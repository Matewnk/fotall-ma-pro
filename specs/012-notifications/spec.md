# Notifications — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Notifications** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

## Références

- `docs/cahier-des-charges.md` (§8.2 événements, §8.3 architecture événementielle)
- `.specify/memory/constitution.md`
- `docs/architecture/architecture.md`
- `docs/testing/test-strategy.md`

## Exigences

- Les autorisations sont vérifiées côté serveur.
- Toute donnée tenant-scoped est strictement isolée.
- Les jobs et exports conservent le contexte tenant.
- Les opérations critiques sont idempotentes.

## Mécanisme implémenté

Architecture événementielle interne (`@nestjs/event-emitter`), conforme au
cahier des charges §8.3 : le domaine métier (Commandes, Licence, Onboarding)
émet des événements nommés et n'appelle **jamais** un fournisseur de
notification directement. `NotificationsEventsListener` est le seul
consommateur ; il résout le destinataire et le canal puis délègue à
`NotificationsService`, point d'entrée unique pour tout envoi.

- **Événements couverts** (§8.2) : `COMMANDE_CREEE`, `COMMANDE_EN_COURS`,
  `COMMANDE_PRETE` (+ `LIVRAISON_PREVUE` si `modeLivraison=LIVRAISON`),
  `COMMANDE_LIVREE`, `LICENCE_PROCHE_EXPIRATION`. `RAPPEL` reste un
  événement de journal défini mais sans déclencheur automatique (aucune
  planification de relance n'est spécifiée dans ce projet).
- **`TEST_CANAL`** (hors liste §8.2, ajouté pour l'étape 3 de l'onboarding
  006 — « test de notification » sur le canal choisi).
- **Canaux** : `FCM`/`WhatsApp`/`SMS`, chacun un adaptateur `NotificationAdapter`
  stub (aucune credential fournisseur réelle dans ce projet — log-only,
  interface déjà en place pour un branchement réel ultérieur).
- **Templates** configurables par événement (`notification-templates.ts`),
  centralisés — un seul point de changement de libellé.
- **Dry-run** (`NOTIFICATIONS_DRY_RUN`, `true` par défaut) : journalise sans
  appeler aucun adaptateur — comportement de développement demandé par le
  cahier des charges.
- **Idempotence** : `idempotencyKey` déterministe par notification
  (`<EVENEMENT>:<commandeId>` ou `<EVENEMENT>:<licenceId>`/`<tenantId>`) —
  un rejeu de l'événement ne réenvoie jamais.
- **Retry borné** (3 tentatives) avant `ECHEC`, avec journal systématique
  (`NotificationLog` : `ENVOYE` / `ECHEC` / `DRY_RUN`), append-only (aucune
  méthode de suppression exposée).
- **Isolation tenant** : `NotificationLog` vit dans le schéma tenant-scoped
  (`TenantPrismaFactory`), comme toute donnée métier — même mécanisme
  d'isolation physique que 003/007.

Referme deux boucles laissées en simple journalisation :

- **004 (Licensing)** : `licence.essai.bientot_expire`, émis par
  `LicenceService.traiterEcheancesEssai()` (job planifié), est maintenant
  consommé pour un envoi réel (dry-run par défaut) sur le canal de
  préférence choisi à l'onboarding.
- **006 (Onboarding)** : `onboarding.notification.test`, émis à l'étape 3,
  déclenche désormais un envoi `TEST_CANAL` réel vers le téléphone du
  tenant.

## Périmètre différé

- Aucun fournisseur FCM/WhatsApp/SMS réel n'est connecté (adaptateurs
  log-only) — aucune credential n'existe dans ce projet.
- `RAPPEL` n'a pas de déclencheur automatique (pas de planification de
  relance spécifiée).
- Pas de préférences de notification par événement (uniquement un canal
  préféré global, par client ou par tenant selon le cas).
- Pas d'API de consultation/replay du journal de notifications (accès
  direct DB uniquement pour l'instant, comme pour `JournalLicence`).

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec.
- [x] Tests unitaires (`notifications.service.spec.ts`,
      `notifications-events.listener.spec.ts`).
- [x] Tests intégration (`notifications.integration.spec.ts`, PostgreSQL réel).
- [x] Tests sécurité/RBAC (aucune route dédiée — déclenché par les routes
      existantes déjà protégées par JWT/RBAC ; `NotificationLog` jamais
      exposé hors du schéma tenant).
- [x] Tests tenant isolation (journal de notifications isolé par schéma).
- [x] Documentation mise à jour.
