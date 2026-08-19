# Orders — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Orders** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

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

- `Commande` + `CommandeArticle` (schéma tenant-scoped), liant `Client` (007) et `Service` (008).
  `numero` auto-incrémenté (affichage `CMD-NNNNNN` côté client si besoin).
- Totaux **toujours calculés côté serveur** : `tarifUnitaire` est copié depuis `Service.tarif` au
  moment de la commande (jamais fourni par le client, jamais recalculé rétroactivement si le
  tarif catalogue change ensuite). `sousTotal` = somme des articles, `total` = `sousTotal - remise`
  (remise validée `0 ≤ remise ≤ sousTotal`).
- Cycle `EN_ATTENTE → EN_COURS → PRET → LIVRE` (`orders.constants.ts`) : toute transition qui
  n'est pas une progression stricte (y compris rester sur place) est refusée (409).
- `idempotencyKey` obligatoire à la création : un rejeu identique renvoie la commande existante
  sans recalculer ni dupliquer.
- Permissions : création réservée à `ADMIN`+`CAISSIER` (prise de commande) ; lecture et mise à
  jour de statut ouvertes à `ADMIN`+`CAISSIER`+`TECHNICIEN`+`LIVREUR` (chacun intervient à une
  étape du cycle, cahier des charges §2.1). `@RequireActiveLicence()` sur create et sur la mise à
  jour de statut.
- `modeLivraison: LIVRAISON` exige `adresseLivraison` (validé côté serveur).

## Périmètre différé

- Pas de modification du contenu d'une commande après création (articles/remise) : seule la
  transition de statut est exposée. Modifier une commande déjà passée n'est pas dans le périmètre
  du cahier des charges pour cette spec.
- Pas de suppression : cohérent avec l'intégrité des enregistrements transactionnels (comme la
  caisse, spec 010, append-only).
- Zone/créneau/preuve de remise pour la livraison (cahier des charges §6.4) : différé, aucune
  fonctionnalité de tournée livreur n'existe encore (specs ultérieures).

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec.
- [x] Tests unitaires (`orders.service.spec.ts` — calcul, remise, transitions, idempotence).
- [x] Tests intégration réels contre PostgreSQL (`orders.integration.spec.ts`, job CI
      `integration`) : création, calcul, remise, transitions, permissions, isolation,
      idempotency key.
- [x] Tests sécurité/RBAC (TECHNICIEN → 403 en création, autorisé en transition de statut).
- [x] Tests tenant isolation (GET/LIST/transition de statut cross-tenant, via HTTP réel).
- [x] Documentation mise à jour (cette spec).
