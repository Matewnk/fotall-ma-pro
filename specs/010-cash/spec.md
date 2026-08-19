# Cash — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Cash** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

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

- `OperationCaisse` (schéma tenant-scoped) : journal **append-only** — aucune méthode
  update/delete n'existe dans `CashService`, volontairement, et le modèle Prisma n'a même pas de
  `updatedAt` (Constitution IV). Une correction est une nouvelle opération
  `AJUSTEMENT_COMPENSATOIRE`, jamais une modification d'une ligne existante.
- 7 types : `OUVERTURE`, `ENCAISSEMENT`, `AVANCE`, `DEPENSE`, `REMBOURSEMENT`,
  `AJUSTEMENT_COMPENSATOIRE`, `CLOTURE`. Chaque événement porte tenant (implicite via le schéma),
  opérateur, type, montant, référence, timestamp, mode de paiement, idempotency key.
- **Solde déterministe** : jamais un compteur mutable, toujours recalculé en sommant l'effet signé
  de chaque événement (`cash.constants.ts`). Cette conception rend le résultat final
  intrinsèquement indépendant de l'ordre d'arrivée des événements (addition commutative) — exactement
  la propriété exigée par le cahier des charges §9.5 pour la synchronisation offline à venir (016),
  obtenue ici sans effort supplémentaire.
- `idempotencyKey` obligatoire : un doublon réseau (retry côté client) renvoie l'opération
  existante sans en recréer une seconde.
- `ADMIN`+`CAISSIER` uniquement. `@RequireActiveLicence()` sur l'enregistrement d'opérations ;
  lecture (journal, solde) toujours disponible (§13.4).

## Périmètre différé

- Réouverture après clôture / rattachement d'une opération offline arrivée en retard à sa journée
  métier (cahier des charges §9.5) : nécessite la synchronisation offline, spec 016.
- Lien formel `commandeId`/`clientId` : champs de référence simples (pas de contrainte FK stricte)
  pour rester flexible sur ce qui peut être rattaché à une opération de caisse.

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec.
- [x] Tests unitaires (`cash.service.spec.ts` — signes par type, doublon réseau, solde
      indépendant de l'ordre).
- [x] Tests intégration réels contre PostgreSQL (`cash.integration.spec.ts`, job CI
      `integration`) : deux caissiers, doublon réseau, remboursement, clôture, permissions,
      isolation.
- [x] Tests sécurité/RBAC (TECHNICIEN → 403).
- [x] Tests tenant isolation (journal et solde cross-tenant, via HTTP réel).
- [x] Documentation mise à jour (cette spec).
