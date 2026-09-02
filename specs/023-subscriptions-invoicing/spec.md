# Subscriptions & Invoicing — Fotall-Ma Pro

## Objectif

Donner au SUPER_ADMIN une vraie gestion professionnelle des abonnements
tenant (avec historique des changements de plan/prix) et la génération de
factures PDF, en réutilisant l'existant (`Abonnement`, `JournalPaiement`,
infrastructure PDF de 011-tickets) plutôt qu'en dupliquant un second système
financier.

## Références

- `docs/cahier-des-charges.md` (§13.6, §14)
- `.specify/memory/constitution.md` (IV — finance append-only)
- `specs/017-billing/spec.md` (déjà écrit : anticipe explicitement ce
  besoin — _"Pas de génération de facture PDF/reçu [...] qui pourraient
  être réutilisés plus tard"_)
- `specs/011-tickets-printing/` (infrastructure PDFKit réutilisée)

## Note de numérotation

Le numéro `022` a été utilisé de façon informelle (commentaires de code
uniquement, jamais de dossier `specs/022-*`) pour une mission Super-Admin
précédente déjà livrée (vue globale, plans, facturation globale, audit,
support). Cette fonctionnalité prend donc le numéro `023` pour éviter toute
collision. Un `specs/022-super-admin-enhancement/spec.md` rétroactif reste à
écrire séparément — hors périmètre de ce document.

## Décisions explicites (pour éviter d'inventer une règle métier)

- **Pas de prorata** au changement de plan : le nouveau prix s'applique à
  la prochaine facture, aucun calcul de prorata n'existe dans le cahier
  des charges — à ajouter seulement sur décision explicite ultérieure.
- **Pas de TVA/taxe** : aucun régime fiscal n'est défini nulle part dans
  le projet (schéma, cahier des charges, ADR). La facture affiche un
  **total unique**, sans ligne "Total HT" / "Taxes" séparée. Si une
  politique fiscale est communiquée plus tard, une évolution du modèle
  `Facture` l'ajoutera explicitement (jamais un taux inventé entre-temps).
- **Pas d'informations légales inventées** : numéro fiscal, raison
  sociale, coordonnées bancaires n'existent pas sur `Tenant` — absents du
  gabarit de facture plutôt que remplis avec des valeurs fictives.
  "Propriétaire" reste l'email du premier ADMIN (`Tenant` n'a pas de champ
  nom de contact) — déjà le comportement de la fiche tenant existante.
- **Snapshot obligatoire** : une facture émise fige (copie) le nom du
  tenant, l'email du propriétaire, le plan et le prix au moment de
  l'émission — jamais une lecture live de `Tenant`/`Abonnement`, pour
  qu'une facture déjà émise ne change jamais rétroactivement.
- **Statuts de facture** : `EMISE` / `PAYEE` / `EN_RETARD` / `ANNULEE` —
  choisis pour rester dans la même convention française que
  `StatutAbonnement` (`ACTIF`/`EN_RETARD`/`ANNULE`) déjà en base, plutôt
  que d'introduire un vocabulaire anglais (`DRAFT`/`ISSUED`/...) qui
  n'existe nulle part ailleurs dans le schéma.
- **Numérotation de facture** : `FAC-<année>-<compteur global
4 chiffres>` (ex. `FAC-2026-0001`), compteur strictement croissant,
  jamais réutilisé même après annulation — cohérent avec l'esprit
  append-only (aucun numéro ne "libère" sa place).

## Mécanisme implémenté

- **`HistoriqueAbonnement`** (control-plane, append-only) : une ligne par
  changement de plan/prix — ancien plan, nouveau plan, ancien prix,
  nouveau prix, acteur (SUPER_ADMIN), motif, date d'effet. Écrite par
  `PATCH /super-admin/tenants/:id/plan` en plus (jamais à la place) de
  l'audit existant sur le tenant.
- **`Facture`** (control-plane) : numéro, tenantId, snapshot des infos
  tenant/abonnement au moment de l'émission, période facturée, montant,
  devise, statut, date d'émission, date d'échéance, référence de paiement
  optionnelle (`JournalPaiement.id` si le paiement correspondant existe
  déjà — jamais un second enregistrement du montant payé).
- **`POST /super-admin/tenants/:id/factures`** : génère une facture pour
  la période courante de l'abonnement du tenant, à partir des données déjà
  en base (aucune ressaisie). Refuse une double génération pour la même
  période (contrainte unique tenant+période).
- **`GET /super-admin/tenants/:id/factures`** et
  **`GET /super-admin/factures`** (vue globale, filtrable tenant/plan/
  statut/période) : lecture seule.
- **`GET /super-admin/factures/:id/pdf`** : génère le PDF à la demande
  (PDFKit, réutilise le style déjà en place dans
  `apps/api/src/tickets/*.builder.ts` — logo, séparateurs pointillés,
  montants alignés — adapté au format A4 professionnel demandé).
- **`PATCH /super-admin/factures/:id/statut`** : uniquement
  `EMISE → PAYEE` ou `EMISE/PAYEE → ANNULEE` — jamais de suppression, la
  facture reste consultable après annulation (traçabilité).
- Toutes les routes `SUPER_ADMIN` uniquement, isolation cross-tenant
  testée (l'ADMIN d'un tenant ne peut jamais lire la facture d'un autre
  tenant, même en devinant son id).
- Fiche tenant réorganisée en sections distinctes : Informations /
  Licence / Abonnement / Factures / Paiements / Utilisateurs / Support /
  Audit (au lieu des sections actuelles Licence/Plan/Facturation/Support
  mélangeant abonnement et facturation).

## Périmètre différé

- Aucune intégration de paiement en ligne réelle (inchangé depuis
  017-billing).
- Prorata au changement de plan (voir Décisions).
- TVA/taxes (voir Décisions).
- Export comptable (CSV/compta) — non demandé, à cadrer séparément si
  besoin.
- Auto-génération périodique des factures (cron) — cette itération reste
  manuelle (le SUPER_ADMIN clique "Créer une facture") ; l'automatisation
  est un raccordement futur, même logique que le job `BillingScheduler`
  déjà existant pour les relances.

## Critères d'acceptation (Phase 1 — Super-Admin)

- [x] `HistoriqueAbonnement` alimenté à chaque changement de plan, visible
      sur la fiche tenant.
- [x] Génération de facture sans ressaisie, snapshot correct, numéro
      unique et croissant, refus de double génération pour une même
      période.
- [x] PDF téléchargeable/imprimable, format A4, aucune donnée inventée
      (pas de TVA, pas de numéro fiscal).
- [x] Page globale Facturation avec KPI réels et filtres.
- [x] Fiche tenant réorganisée en sections distinctes.
- [x] Tests unitaires + intégration (génération, double génération,
      changement de statut, PDF, RBAC, isolation cross-tenant).
- [x] Aucune régression sur `Abonnement`/`JournalPaiement`/`Licence`
      existants.
- [x] Actions sensibles (création facture, changement de statut)
      auditées (utilisateur/action/tenant/date/métadonnées).

## Phase 2 — Espace propriétaire (lecture seule)

### Objectif

Donner à l'ADMIN d'un tenant un accès en **lecture seule** à son propre
abonnement, son historique de paiements et ses factures — jamais aux
données d'un autre tenant. Décidée explicitement en Phase 2 (voir
ci-dessous) : aucune action d'écriture côté tenant dans cette itération.

### Décision explicite : périmètre volontairement limité

- **Lecture seule.** Le tenant consulte : abonnement actuel (plan, statut,
  prix, prochaine échéance), historique des paiements
  (`Abonnement.journal`), ses factures (liste + PDF), plans disponibles
  (catalogue `PlanDefinition`, sans les champs de gestion internes).
- **Explicitement hors périmètre de cette phase** (jamais construit sans
  décision explicite ultérieure) : changement de plan en self-service,
  modification du moyen de paiement, paiement en ligne, réactivation
  automatique, toute logique de proratisation. Ce report est cohérent avec
  la règle déjà en place depuis 017-billing (`billing.service.ts:29-30`) :
  _"en V1 seul le SUPER_ADMIN provisionne un abonnement — le tenant ne
  modifie jamais directement l'état de sa licence."_ Cette phase ne fait
  que l'appliquer au domaine facturation, elle ne l'invente pas.
- **Pas de nouveau système de permissions** : réutilisation stricte du
  catalogue fermé de 021-permissions-granulaires
  (`permissions.constants.ts`).

### Mécanisme proposé

- Nouvelle permission catalogue : **`facturation.read`**. Ajoutée à
  `PERMISSIONS_CONNUES` (donc automatiquement par défaut pour ADMIN, qui
  reçoit tout le catalogue) ; **non ajoutée** aux défauts CAISSIER/
  TECHNICIEN/LIVREUR (donc 403 par défaut) ; **pas** ajoutée à
  `PERMISSIONS_NON_CONFIGURABLES` — un ADMIN pourra plus tard déléguer la
  consultation à un CAISSIER de confiance via le mécanisme d'override déjà
  existant, sans nouveau code.
- Nouvelles routes tenant-scoped, dérivées de `@CurrentTenant()` (jamais
  un `tenantId` fourni par le client, même principe que
  `clients.controller.ts`) :
  - `GET /abonnement` — abonnement du tenant courant (404 si aucun,
    jamais l'abonnement d'un autre tenant).
  - `GET /factures` — factures du tenant courant, `GET /factures/:id`
    (404, jamais 403, si la facture n'appartient pas au tenant — même
    convention que `support-tickets.controller.ts`).
  - `GET /factures/:id/pdf` — réutilise `buildInvoicePdf` déjà existant
    (`apps/api/src/invoices/invoice.builder.ts`), aucune duplication.
  - `GET /plans` — lecture du catalogue `PlanDefinition`, tout rôle
    authentifié tenant-scoped, sans `updatedBy`.
- Page web `apps/web/src/pages/BillingSelfServicePage.tsx`, route
  `/facturation` dans `AppShell`, lien menu visible seulement si
  `facturation.read` (même pattern que les liens `roles`/permission déjà
  filtrés dans `AppShell.tsx`) : carte abonnement, carte prochaine
  échéance, table paiements (filtres Tous/Payés/Impayés/Remboursés),
  table factures (filtres Toutes/Payées/Impayées), téléchargement PDF.
  États loading / empty / error explicites (aucune donnée inventée en
  attendant le chargement).

### Critères d'acceptation (Phase 2)

- [x] `GET /abonnement`, `/factures`, `/factures/:id`, `/factures/:id/pdf`,
      `/plans` : tenant-scoped, jamais un id fourni par le client comme
      preuve d'appartenance.
- [x] Permission `facturation.read` : ADMIN par défaut, CAISSIER/
      TECHNICIEN/LIVREUR 403 par défaut, configurable via override 021.
- [x] Isolation cross-tenant testée : ADMIN Tenant A → 404 (jamais 403) sur
      une facture de Tenant B.
- [x] Page "Abonnement & facturation" : abonnement, historique paiements
      (filtres), factures (filtres payées/impayées), téléchargement PDF.
- [x] États loading/empty/error couverts par des tests.
- [x] Aucune action d'écriture ajoutée côté tenant (conforme à la
      décision explicite ci-dessus).

### Aperçu de renouvellement (toujours Phase 2, toujours lecture seule)

Décision explicite (voir ADR-006, section "Espace propriétaire") : préparer
l'interface de renouvellement sans l'activer, en attendant une intégration
de paiement réelle.

- Le bandeau "Prochain paiement" distingue 3 niveaux dérivés des champs
  déjà exposés par `GET /abonnement` (`statut` + `dateProchaineFacturation`),
  aucun nouveau statut backend : normal, proche de l'échéance (≤ 7 jours),
  expiré (`EN_RETARD`/`ANNULE` ou échéance déjà passée).
- Bouton "Renouveler mon abonnement" / "Renouveler maintenant" /
  "Réactiver mon abonnement" selon le niveau → ouvre une modal de
  confirmation 100 % client (plan actuel, montant, aperçu de nouvelle
  période calculé côté frontend sur la même durée de cycle que
  `JOURS_CYCLE_FACTURATION`).
- **Aucun appel réseau** déclenché par la modal : le bouton de confirmation
  est désactivé et affiche "Le paiement en ligne sera disponible
  prochainement. Contactez le support pour renouveler votre abonnement."
  Aucune route backend ajoutée ou modifiée pour cet aperçu.

Critères d'acceptation :

- [x] 3 niveaux (actif / proche / expiré) testés indépendamment.
- [x] Modal affiche plan, montant et nouvelle période prévisualisée.
- [x] Bouton de confirmation désactivé, aucun appel réseau supplémentaire
      au clic (testé).

## Phase 3 — Initiation de paiement PayTech, mode DRY_RUN uniquement (voir ADR-007)

### Objectif

Préparer le backend d'intégration PayTech (fournisseur retenu, ADR-007)
avant d'obtenir des clés API réelles : route d'initiation, permission
dédiée, journal d'audit — tout testable dès maintenant en simulation,
sans dépendre d'un compte PayTech.

### Décision explicite : backend isolé, UI Phase 2 inchangée

Le bouton "Confirmer le renouvellement" de la modal (Phase 2) reste
désactivé — cette phase ne le rebranche pas. La route d'initiation est
testée directement (curl, tests d'intégration), jamais depuis
`/facturation` pour l'instant.

### Mécanisme implémenté

- **`PaytechService`** (`payment-provider/paytech.service.ts`) : adaptateur
  unique, mode dry-run par défaut (`PAYTECH_DRY_RUN`, défaut `"true"`,
  même convention que `NOTIFICATIONS_DRY_RUN`). En dry-run : simule le
  contrat documenté de `POST /api/payment/request-payment` (token +
  URL de paiement hébergée), sans jamais contacter paytech.sn. Le mode
  réel (`PAYTECH_DRY_RUN=false`) rejette explicitement (non implémenté,
  voir ADR-007) plutôt que d'échouer silencieusement.
- **`POST /factures/:id/renouvellement`** (`billing-self-service.controller.ts`)
  : tenant-scoped (même principe que le reste de la Phase 2), nouvelle
  permission **`facturation.renouveler`** (distincte de `facturation.read`
  — une lecture n'autorise jamais une écriture, même simulée ; ADMIN par
  défaut, CAISSIER/TECHNICIEN/LIVREUR 403 par défaut, délégable via
  l'override 021 existant). Refuse une facture déjà `PAYEE`/`ANNULEE`
  (409). Journalise `FACTURE_RENOUVELLEMENT_INITIE` dans l'audit tenant
  existant (`AuditService`).
- **Aucune écriture financière** dans cette route : ni changement de
  statut de facture, ni entrée `JournalPaiement`. Le webhook existant
  (`/facturation/webhook`) reste l'unique source de vérité d'un paiement
  réel — inchangé par cette phase.

### Critères d'acceptation (Phase 3)

- [x] `PaytechService` dry-run testé (tokens distincts, mode réel rejeté
      explicitement).
- [x] `POST /factures/:id/renouvellement` : tenant-scoped, 404 (jamais 403) sur la facture d'un autre tenant.
- [x] Permission `facturation.renouveler` : ADMIN par défaut,
      CAISSIER/TECHNICIEN/LIVREUR 403 par défaut.
- [x] Refus (409) sur une facture déjà payée/annulée.
- [x] Audit `FACTURE_RENOUVELLEMENT_INITIE` vérifié par test.

## Phase 4 — Renouvellement self-service depuis /facturation (voir ADR-006, ADR-007)

### Objectif

Permettre au propriétaire/ADMIN de renouveler réellement son abonnement
(durée choisie, paiement DRY_RUN, prolongation effective) directement
depuis `/facturation` — supersede la décision Phase 3 "backend isolé,
bouton toujours désactivé" : la route `POST /factures/:id/renouvellement`
est remplacée par `POST /abonnement/renouvellement` (voir ci-dessous), et
la modal Phase 2 est rebranchée pour déclencher le flux réel.

### Décisions explicites (audit avant code — voir CLAUDE.md §Méthode)

- **Statut fusionné** : `Abonnement.statut` (facturation) et
  `Licence.statut` (accès réel, `ESSAI/ACTIVE/EXPIREE/SUSPENDUE`) sont deux
  modèles distincts — aucun des deux ne porte seul les 4 états demandés
  (`ACTIF/EXPIRÉ/SUSPENDU/ANNULÉ`). La page fusionne : `ANNULE` (Abonnement)
  prime, sinon `Licence.statut` (EXPIREE→Expiré, SUSPENDUE→Suspendu, sinon
  Actif). Aucun nouveau champ backend.
- **Date de début / date d'expiration** : `Licence.dateActivation` /
  `Licence.dateExpirationCourante` (déjà en base) — exposés en plus dans
  `GET /abonnement` (`licence: {...}`), additif, rien retiré.
- **Tarif officiel** : toujours `Abonnement.montant` (déjà la convention
  de `InvoicesService#creerPourTenant`), jamais `PlanDefinition` (catalogue
  de référence uniquement). Montant total = `Abonnement.montant × dureeMois`,
  calculé côté serveur uniquement (le DTO ne whiteliste que `dureeMois`).
- **Durée = jours, pas calendrier** : 1 mois = `JOURS_CYCLE_FACTURATION`
  (30 jours), même convention que le reste du module — jamais une seconde
  définition du cycle.
- **La facture sert d'ancre au paiement** : créée `EMISE` dès l'initiation
  (`InvoicesService#creerPourRenouvellementTenant`), marquée `PAYEE` à la
  confirmation — jamais un second modèle "intention de paiement".
- **Confirmation DRY_RUN** : `POST /factures/:id/confirmer-dry-run`
  (404 si `PAYTECH_DRY_RUN=false`) réutilise
  `BillingService#traiterEvenementPaiement` — même chemin qu'un vrai
  webhook PayTech, aucune logique de confirmation dupliquée.
- **Renouvellement anticipé** : `Abonnement.dateProchaineFacturation` et
  `Licence.dateExpirationCourante` préservent désormais tous deux le temps
  restant si renouvelé avant échéance (avant cette phase, seul
  `Licence` le faisait — incohérence corrigée, comportement existant du
  cycle fixe inchangé sinon).

### Mécanisme implémenté

- `GET /abonnement` : additif, inclut `licence`.
- `POST /abonnement/renouvellement` (remplace `POST /factures/:id/renouvellement`) :
  `{ dureeMois: 1|3|6|12 }`, crée la facture, initie PayTech, retourne l'aperçu
  (plan/montant/durée/dates).
- `POST /factures/:id/confirmer-dry-run` : dev-only, simule l'IPN.
- `BillingService#traiterEvenementPaiement` : rétrocompatible — sans
  `referenceProvider`, comportement Super-Admin inchangé (cycle fixe).
- Page `/facturation` : sections Mon abonnement (badge fusionné, dates,
  limites), Prochain paiement (ou "aucun paiement programmé" si ANNULE),
  modal 3 étapes (choix durée → paiement en cours → succès ou erreur),
  factures (filtre Toutes/Payées/Impayées/En attente), historique
  paiements (référence, moyen, facture associée).

### Critères d'acceptation (Phase 4)

- [x] Montant et période toujours recalculés côté serveur (testé : un
      montant fourni par le client est rejeté par le DTO).
- [x] Confirmation DRY_RUN : facture PAYEE, Abonnement + Licence
      prolongés (temps restant préservé), paiement journalisé (testé).
- [x] Double confirmation impossible (409).
- [x] Isolation cross-tenant sur l'initiation et la confirmation (404,
      jamais 403).
- [x] RBAC : ADMIN par défaut, CAISSIER/TECHNICIEN/LIVREUR 403 par défaut
      sur `facturation.renouveler` (testé).
- [x] Frontend : 13 tests (états actif/proche/expiré/annulé/vide/erreur,
      ouverture modal, choix durée + calcul, flux DRY_RUN complet,
      erreur d'initiation, filtres factures, historique paiements).
- [x] Aucune régression sur le flux Super-Admin existant (`billing.
integration.spec.ts`, `invoices.integration.spec.ts` toujours verts).
- [x] Aucune modification de l'UI Phase 2 (bouton toujours désactivé).
