# ADR-007 — Paiement en ligne : PayTech (Mobile Money + carte)

Fournisseur retenu pour l'intégration réelle du renouvellement d'abonnement
(aperçu déjà préparé côté self-service, voir [[ADR-006]] et
`specs/023-subscriptions-invoicing/spec.md` §"Aperçu de renouvellement") :
**PayTech** (paytech.sn), agrégateur sénégalais couvrant Orange Money,
Wave, Free Money, Wizall, E-money et cartes Visa/Mastercard derrière une
seule API. Évite un adaptateur par opérateur mobile money et couvre la
contrainte `CLAUDE.md` _"Stripe ou Mobile Money local approuvé"_.

## Modèle de compte marchand

Un seul compte marchand PayTech, au nom de Fotall-Ma Pro — jamais un par
tenant. Le produit vendu ici est l'abonnement SaaS du tenant envers la
plateforme (`SUPER_ADMIN` pilote la facturation globale, §Rôles
`CLAUDE.md`), pas une transaction entre un pressing et son propre client.
Ce choix découle directement du modèle déjà en place — `Abonnement` et
`Facture` sont control-plane, jamais tenant-scoped — aucune architecture
alternative à trancher ici.

## Flux d'intégration

1. Le tenant clique "Renouveler mon abonnement" (bouton déjà livré) → une
   nouvelle route self-service (à créer, hors périmètre lecture-seule
   actuel) appelle côté serveur `POST
https://paytech.sn/api/payment/request-payment` avec `item_name`,
   `item_price` (= `Abonnement.montant`), `currency`, `ref_command` (= id
   de la `Facture` à régler), `ipn_url`, `success_url`, `cancel_url`.
2. Le frontend redirige le tenant vers l'URL de paiement hébergée renvoyée
   par PayTech — jamais de formulaire carte/mobile money géré directement
   par Fotall-Ma (hors périmètre PCI, PayTech est certifié PCI-DSS/3D
   Secure).
3. PayTech notifie `ipn_url` → traduit vers le `WebhookPaiementDto`
   existant → `BillingService.traiterEvenementPaiement` inchangé. Le
   `WebhookSecretGuard` actuel (secret statique, pense-bête temporaire) est
   remplacé par la vérification de signature réelle PayTech.
4. Le tenant est redirigé vers `success_url`/`cancel_url` (pages de retour
   à créer) — l'état réel de la facture reste celui écrit par l'IPN,
   jamais celui déduit du seul retour navigateur (l'utilisateur peut
   fermer l'onglet avant la redirection).

## Ce qui ne change pas

`Abonnement`/`Facture`/`JournalPaiement` ([[ADR-006]]),
`traiterEvenementPaiement`, la forme `WebhookPaiementDto`. Le webhook
`/facturation/webhook` reste le point d'entrée unique — seule sa
vérification de secret évolue.

## Secrets

`PAYTECH_API_KEY` / `PAYTECH_SECRET_KEY` : variables d'environnement,
jamais commit (`CLAUDE.md` §Sécurité). L'environnement de test PayTech
doit être validé avant tout code réel — en attendant, la route
d'initiation reste non implémentée ; l'aperçu Phase 2 déjà livré (modal
sans appel serveur) reste le comportement en vigueur.

## Périmètre différé

Pas de gestion de remboursement (absent du modèle actuel, voir
[[ADR-006]]). Pas de paiement récurrent automatique — chaque renouvellement
reste initié par le tenant.

Détail d'implémentation à venir : `specs/023-subscriptions-invoicing/spec.md`
(nouvelle phase, à écrire lors du démarrage du code réel).
