# ADR-006 — Abonnement, Facture, Paiement : trois entités distinctes

Trois entités control-plane, jamais fusionnées :

- **`Abonnement`** : état courant du contrat (plan, prix, devise, mode de
  paiement, statut, date de prochaine facturation). Un seul par tenant
  (1:1, comme `Licence`). C'est la **source de vérité du prix et du plan
  en vigueur**.
- **`Facture`** : document daté, numéroté, émis pour une période donnée.
  **Fige (snapshot) au moment de l'émission** le nom du tenant, l'email du
  propriétaire, le plan et le prix — jamais une lecture live de
  `Abonnement`/`Tenant`, pour qu'une facture déjà émise ne change jamais
  rétroactivement si le tenant est renommé ou change de plan ensuite.
- **`JournalPaiement`** : journal append-only des évènements de paiement
  (`PAIEMENT_REUSSI`, `PAIEMENT_ECHEC`, `RELANCE_ENVOYEE`), lié à
  l'`Abonnement`. C'est la **source de vérité de ce qui a réellement été
  encaissé**. Une `Facture` peut référencer un `JournalPaiement` existant
  (`paiementRefId`) quand le paiement correspondant est déjà connu — jamais
  un second enregistrement du montant payé, jamais un système financier
  parallèle.

## Historique des changements

`HistoriqueAbonnement` (append-only, distinct du journal de paiement) trace
chaque changement de plan/prix : ancien/nouveau plan, ancien/nouveau prix,
acteur, motif, date d'effet. `Abonnement` ne garde que l'état courant —
sans ce journal séparé, un changement de plan effacerait silencieusement
la trace de l'ancien prix.

## Génération de facture

Manuelle en V1 (le SUPER_ADMIN déclenche `POST
/super-admin/tenants/:id/factures`), sans ressaisie : toutes les données
viennent de `Abonnement` + `Tenant` au moment de l'appel. La période
couverte est dérivée de `Abonnement.dateProchaineFacturation` et du cycle
de facturation déjà défini (`JOURS_CYCLE_FACTURATION`, 017-billing) — pas
une seconde définition du cycle. Une contrainte unique
`(tenantId, periodeDebut)` empêche toute double génération pour la même
période. Le numéro (`FAC-<année>-<compteur global 4 chiffres>`) est
strictement croissant, jamais réutilisé même après annulation.

## Statuts

`Abonnement.statut` (`ACTIF`/`EN_RETARD`/`ANNULE`) et `Facture.statut`
(`EMISE`/`PAYEE`/`EN_RETARD`/`ANNULEE`) sont deux machines à états
séparées, dans la même convention française déjà en base plutôt qu'un
vocabulaire anglais (`DRAFT`/`ISSUED`/...) introduit sans raison.
`EN_RETARD` sur une facture n'est **jamais écrit** : calculé à la lecture
(échéance dépassée sans paiement). `ANNULEE` est un état terminal — jamais
de retour, jamais de suppression (traçabilité, cohérent avec le principe
append-only de la Constitution IV).

## Renouvellement

Reste une action `SUPER_ADMIN` en V1 (`POST
/super-admin/tenants/:id/licence/renouveler`), inchangé depuis 004/017 —
cette ADR ne modifie pas ce mécanisme. Aucun prorata au changement de
plan : le nouveau prix s'applique à la prochaine facture, aucun calcul
n'existe dans le cahier des charges.

## Isolation tenant

Toutes les routes de lecture tenant-scoped (`GET /abonnement`, `/factures`,
`/factures/:id`, `/factures/:id/pdf`) dérivent le tenant du JWT
(`@CurrentTenant()`), jamais d'un id fourni par le client. Une facture
demandée hors de son tenant renvoie **404**, jamais 403 — un 403
confirmerait son existence à un tenant qui n'y a pas droit.

## Espace propriétaire (023 Phase 2)

Le propriétaire d'un tenant consulte son abonnement/factures/paiements en
**lecture seule** (permission `facturation.read`, catalogue 021 existant,
pas de second système). Aucune action d'écriture (changer de plan,
payer, renouveler) tant que la règle V1 de 017-billing reste en vigueur :
_"le tenant ne modifie jamais directement l'état de sa licence/abonnement"_.
Lever cette restriction est un changement d'architecture distinct, à
documenter dans une ADR ultérieure si une intégration de paiement réelle
est décidée.

Détail complet : `specs/023-subscriptions-invoicing/spec.md`.
