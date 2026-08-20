# Mobile & Offline — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Mobile & Offline** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

## Références

- `docs/cahier-des-charges.md` (§18 — Offline-first et synchronisation)
- `.specify/memory/constitution.md`
- `docs/architecture/architecture.md`
- `docs/testing/test-strategy.md`
- `docs/decisions/ADR-004-offline-sync.md`
- `docs/sync-conflict-strategy.md` (détail complet des règles ci-dessous)

## Exigences

- Les autorisations sont vérifiées côté serveur.
- Toute donnée tenant-scoped est strictement isolée.
- Les jobs et exports conservent le contexte tenant.
- Les opérations critiques sont idempotentes.

## Mécanisme implémenté

**Première tranche : couche de données offline uniquement**, décision
explicite (comme 015-web) pour ne pas livrer un seul PR massif couvrant
à la fois le moteur de synchronisation et les écrans mobiles. Aucun
écran n'existe dans cette tranche — voir périmètre différé.

- **Schéma local** (`apps/mobile/src/db/schema.ts`, WatermelonDB/SQLite,
  stack verrouillée) : `clients`, `commandes`, `commande_articles`,
  `operations_caisse`, avec les colonnes de traçabilité exigées par la
  mutation offline (§18.2) : `device_id`, `idempotency_key`,
  `local_created_at`, `synced_at`. Les clients portent en plus un
  horodatage par champ éditable (`nom_updated_at`, etc.), nécessaire à
  la règle de fusion §18.3.
- **Moteur de synchronisation** (`apps/mobile/src/offline/`) : pousse
  les mutations en attente contre les endpoints REST déjà existants
  (`POST /commandes` 009, `PATCH /commandes/:id/statut` 009, `POST
/caisse/operations` 010, `PATCH`/`GET /clients/:id` 007) — aucun
  nouvel endpoint de synchronisation côté API n'était nécessaire.
- **Les 4 règles de conflit du cahier des charges §18.3** implémentées
  et testées : caisse (append-only, documenté — rien à résoudre),
  statut (le plus avancé gagne, avec adoption de la vérité serveur en
  cas de conflit de régression), client (fusion champ par champ selon
  timestamp), commande créée offline (réconciliation d'identifiant,
  pas de conflit métier). Détail complet dans
  `docs/sync-conflict-strategy.md`.
- **Vérifiable sans appareil/simulateur** : le moteur de synchronisation
  et la résolution de conflits sont des fonctions pures ou testées
  contre un vrai `Database` WatermelonDB (adaptateur LokiJS en mémoire,
  `db/test-adapter.ts` — aucun binding natif, seulement pour les tests).

## Périmètre différé

- **Aucun écran mobile** : capture de commande, caisse, mise à jour de
  statut, consultation client — tout reste à construire en React
  Native/Expo dans une PR séparée, qui nécessitera un appareil ou un
  simulateur pour être vérifiée correctement (indisponible dans cet
  environnement, comme pour la vérification navigateur de 015-web).
- **Adaptateur SQLite natif de production** : cette tranche configure
  uniquement l'adaptateur en mémoire (LokiJS) pour les tests. Le
  branchement de l'adaptateur SQLite réel (`@nozbe/watermelondb/adapters/sqlite`)
  est différé à l'implémentation des écrans.
- **Déclenchement automatique** de la synchronisation (au retour réseau,
  en tâche de fond) : `synchroniser()` est actuellement appelable à la
  demande uniquement.
- **Indicateur "synchronisé / en attente / erreur"** (§18.4) : l'état
  qui l'alimenterait existe déjà (`ResultatSynchronisation`), l'écran
  lui-même est différé avec le reste de l'UI mobile.
- **Limite documentée** de la fusion client : le control-plane ne
  connaît qu'un horodatage par ligne (pas par champ) — voir la section
  "Limite connue" de `docs/sync-conflict-strategy.md`.

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec (pour le périmètre "couche de
      données" livré).
- [x] Tests unitaires (`conflict-resolution.spec.ts` : 9 tests sur les
      règles pures de conflit ; `sync-engine.spec.ts` : 12 tests contre
      un vrai `Database` WatermelonDB en mémoire).
- [ ] Tests intégration (pas d'appel réseau réel dans cette tranche —
      le moteur est testé contre un `ApiClient` simulé ; l'intégration
      avec l'API réelle sera testée lors du branchement des écrans).
- [x] Tests sécurité/RBAC (non applicable ici — aucune nouvelle route
      API, le RBAC des endpoints consommés est déjà testé dans leurs
      specs respectives, 007/009/010).
- [ ] Tests tenant isolation (une base locale appartient à un seul
      tenant — pas de scénario multi-tenant à tester côté mobile).
- [x] Documentation mise à jour (`docs/sync-conflict-strategy.md` créé).
