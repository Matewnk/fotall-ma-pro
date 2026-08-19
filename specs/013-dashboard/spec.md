# Dashboard — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Dashboard** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

## Références

- `docs/cahier-des-charges.md` (§4 — KPIs, commandes récentes, alertes)
- `.specify/memory/constitution.md`
- `docs/architecture/architecture.md`
- `docs/testing/test-strategy.md`

## Exigences

- Les autorisations sont vérifiées côté serveur.
- Toute donnée tenant-scoped est strictement isolée.
- Les jobs et exports conservent le contexte tenant.
- Les opérations critiques sont idempotentes.

## Mécanisme implémenté

`GET /dashboard` — endpoint unique, lecture seule, agrégeant les données déjà
tenant-scoped (Commande, CommandeArticle, OperationCaisse) et le statut de
licence du control-plane (LicenceService, 004) en une seule réponse
`{ kpis, commandesRecentes, alertes }`.

- **KPIs (§4.1)** : commandes du jour, chiffre d'affaires du jour (somme des
  totaux des commandes créées le jour même), articles en attente (somme des
  quantités des articles dont la commande n'est pas `LIVRE`), livraisons
  prévues aujourd'hui, commandes en retard, revenus des 7 derniers jours
  (série de 7 points, un par jour, du plus ancien au plus récent).
- **Commandes récentes (§4.2)** : les 10 dernières commandes du tenant
  (numéro, client, date, montant, statut).
- **Alertes (§4.3)** :
  - `commandesUrgentes` : commande non livrée dont la date prévue tombe
    dans les 2 prochaines heures — seuil non spécifié par le cahier des
    charges, interprétation documentée dans `dashboard.constants.ts`.
  - `retards` : même calcul que le KPI "commandes en retard" (date prévue
    dépassée, commande non livrée).
  - `paiementsEnAttente` : commande dont le total encaissé (opérations
    `OperationCaisse` de type `ENCAISSEMENT` liées, 010-cash) est inférieur
    à son total — quel que soit son statut de traitement (une commande déjà
    livrée mais non soldée reste signalée).
  - `livraisonsDuJour` : même calcul que le KPI "livraisons prévues
    aujourd'hui".
  - `erreursSynchronisation` : toujours `0` — voir périmètre différé.
  - `licenceProcheExpiration` : `{ active, joursRestants }`, réutilise
    `LicenceService.getStatut()` et le même seuil de 48h que l'alerte de
    licence (004/012), jamais recalculé indépendamment.
- **Isolation tenant** : toutes les requêtes passent par
  `TenantPrismaFactory.forTenant()`, comme tout module métier depuis 003/007.
- **RBAC** : `ADMIN`, `CAISSIER`, `TECHNICIEN`, `LIVREUR` — lecture seule,
  ouverte à tous les rôles opérationnels (aucun rôle n'est exclu d'un
  tableau de bord). Jamais de `LicenceActiveGuard` : un tenant à l'essai
  expiré doit encore pouvoir consulter son tableau de bord (et y voir
  l'alerte de licence qui l'explique).

## Périmètre différé

- `erreursSynchronisation` est structurellement toujours `0` : aucune
  synchronisation offline n'existe encore (016-mobile-offline). Le champ
  est déjà présent dans la forme de réponse pour éviter un changement de
  contrat plus tard.
- Pas de scoping par rôle du contenu du dashboard (ex. un LIVREUR ne voit
  aujourd'hui pas une vue restreinte à ses seules livraisons) — hors
  périmètre du cahier des charges §4, qui ne le demande pas explicitement.
- Pas de cache : chaque appel recalcule tous les agrégats en direct. Adapté
  au volume V1 (un schéma par tenant, données limitées) ; à revisiter si la
  volumétrie l'exige.
- "Chiffre d'affaires du jour" est interprété comme la somme des totaux des
  commandes créées le jour même (revenu facturé), pas comme le montant
  effectivement encaissé (`OperationCaisse`) — cohérent avec le sens usuel
  de "chiffre d'affaires" en comptabilité, mais à confirmer si une
  définition différente était attendue.

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec.
- [x] Tests unitaires (`dashboard.service.spec.ts`).
- [x] Tests intégration (`dashboard.integration.spec.ts`, PostgreSQL réel).
- [x] Tests sécurité/RBAC (rôles opérationnels autorisés, accès non
      authentifié refusé).
- [x] Tests tenant isolation.
- [x] Documentation mise à jour.
