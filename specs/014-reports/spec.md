# Reports & Exports — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Reports & Exports** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

## Références

- `docs/cahier-des-charges.md` (§10 — rapports et statistiques)
- `.specify/memory/constitution.md`
- `docs/architecture/architecture.md`
- `docs/testing/test-strategy.md`

## Exigences

- Les autorisations sont vérifiées côté serveur.
- Toute donnée tenant-scoped est strictement isolée.
- Les jobs et exports conservent le contexte tenant.
- Les opérations critiques sont idempotentes.

## Mécanisme implémenté

8 rapports (§10.1), chacun exposé sous `GET /rapports/<nom>`, tous
tenant-scoped via `TenantPrismaFactory`. Un contrat de réponse unique
(`TableauRapport` : `colonnes`, `lignes`, `resume?`) sert à la fois de
réponse JSON et de source pour les exports — aucune double représentation
à maintenir.

- `caisse-quotidienne` : journal du jour + sous-totaux par type
  d'opération + solde d'ouverture/clôture (même calcul déterministe par
  rejeu que `CashService.solde()`, 010).
- `activite` : nombre de commandes par statut + chiffre d'affaires sur une
  période libre (`from`/`to`) — une seule implémentation couvre
  "quotidienne/hebdomadaire/mensuelle" (§10.1), la granularité étant le
  choix de l'appelant plutôt qu'une énumération imposée.
- `recettes-par-service` et `services-populaires` : même agrégat
  sous-jacent (quantité + recettes par service), trié différemment selon
  le rapport demandé.
- `top-clients` : classement par montant total commandé, limité
  (`?limite=`, 10 par défaut).
- `livraisons-retraits` : répartition des commandes par mode de
  livraison.
- `commandes-en-retard` : liste complète (pas seulement un compteur,
  contrairement à l'alerte du tableau de bord 013) des commandes non
  livrées en retard — pour permettre une relance client.
- `paiements` : répartition des encaissements par mode de paiement
  (010-cash).

**Exports (§10.2)** : chaque endpoint accepte `?format=json|csv|pdf`
(JSON par défaut). CSV généré sans dépendance (échappement RFC 4180
minimal). PDF via `pdfkit` (déjà utilisé en 011), un tableau texte simple
avec résumé.

**RBAC** : `ADMIN` uniquement (cahier des charges §2.1 : seul le rôle
Administrateur "consulte les rapports de son tenant" — CAISSIER/
TECHNICIEN/LIVREUR n'y sont pas mentionnés, à la différence du tableau de
bord 013 qui est ouvert à tous). Jamais de `LicenceActiveGuard` : lecture
seule.

## Périmètre différé

- **Export Excel** : seuls CSV et PDF sont implémentés. Excel (format
  OOXML) nécessiterait une nouvelle dépendance (ex. `exceljs`) — reporté,
  aucune contrainte technique ne l'empêche d'être ajouté plus tard sans
  toucher au contrat `TableauRapport` existant.
- **Exports asynchrones pour volumétrie importante** (§10.2 : "Les exports
  volumineux sont exécutés en tâche asynchrone avec tenant context") :
  tous les exports sont actuellement synchrones (réponse HTTP directe).
  Une file de jobs (BullMQ + Redis, déjà dans la stack verrouillée mais
  jamais encore branchée dans ce projet) est un changement structurant
  qui justifie une décision humaine et un ADR avant introduction —
  non entrepris ici. Adapté au volume V1 (un schéma par tenant, données
  limitées).
- Pas de persistance/historique des exports générés (générés à la volée
  à chaque appel, jamais stockés).
- "Chiffre d'affaires" (rapport `activite`) suit la même interprétation
  que le tableau de bord (013) : total facturé (`Commande.total`), pas
  montant encaissé.

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec.
- [x] Tests unitaires (`reports.service.spec.ts`,
      `reports-export.util.spec.ts`).
- [x] Tests intégration (`reports.integration.spec.ts`, PostgreSQL réel :
      les 8 rapports, export CSV/PDF, format invalide rejeté).
- [x] Tests sécurité/RBAC (ADMIN autorisé, CAISSIER refusé, accès non
      authentifié refusé).
- [x] Tests tenant isolation.
- [x] Documentation mise à jour.
