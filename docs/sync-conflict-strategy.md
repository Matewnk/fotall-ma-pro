# Stratégie de synchronisation et de résolution de conflits (offline)

Document demandé par `CLAUDE.md` (§ Offline) et le cahier des charges §18
("Offline-first et synchronisation"). Référence : `ADR-004-offline-sync.md`.
Implémentation : `apps/mobile/src/offline/` (spec 016-mobile-offline,
tranche "couche de données" — voir `specs/016-mobile-offline/spec.md` pour
le périmètre exact livré/différé).

## Opérations prioritaires hors-ligne (§18.1)

- création de commande ;
- opérations de caisse ;
- statuts de traitement ;
- consultation des clients déjà synchronisés (et, en pratique, leur
  édition locale — voir la règle de fusion ci-dessous).

## Enveloppe de mutation (§18.2)

Chaque mutation créée hors-ligne porte : `tenant_id`, `device_id`, UUID
local, `idempotency_key`, timestamp local, type d'opération
(`apps/mobile/src/offline/types.ts`, `EnveloppeMutation`). `tenant_id`
n'est pas répété colonne par colonne dans le schéma local
(`apps/mobile/src/db/schema.ts`) : une base WatermelonDB locale
appartient à une seule session tenant à la fois, exactement comme un JWT
côté API n'autorise jamais qu'un seul tenant par requête.

## Règles de résolution (§18.3)

### Caisse — append-only, aucun écrasement

Une opération de caisse créée hors-ligne est un événement ajouté au
journal, jamais fusionné ni réécrit — identique au comportement déjà
garanti côté API (`OperationCaisse`, 010-cash, colonnes append-only sans
`updatedAt`). L'idempotence (`idempotencyKey`) protège déjà contre un
double envoi réseau ; il n'existe donc structurellement aucun conflit à
résoudre pour cette règle, contrairement aux trois suivantes.
Implémentation : `pousserOperationsCaisseEnAttente`
(`sync-engine.ts`).

### Statut commande — le plus avancé gagne

`EN_ATTENTE < EN_COURS < PRET < LIVRE`. Le serveur refuse déjà toute
régression (`ConflictException`, `orders.service.ts`, spec 009) : le
moteur de synchronisation mobile pousse le statut local et, si le
serveur répond par un conflit (le statut serveur a avancé plus loin
entre-temps — autre appareil, autre opérateur), adopte la vérité serveur
localement plutôt que de réessayer indéfiniment un changement que le
serveur n'acceptera jamais. Implémentation : `resoudreConflitStatut`
(`conflict-resolution.ts`), utilisée par `pousserStatutsEnAttente`
(`sync-engine.ts`).

### Client — fusion champ par champ selon le timestamp du champ

Chaque champ éditable (`nom`, `telephone`, `email`, `adresse`, `notes`)
porte son propre horodatage local de dernière modification
(`nom_updated_at`, etc., dans `db/schema.ts`). Le serveur ne connaît en
revanche qu'un seul horodatage par ligne (`Client.updatedAt`) : la
fusion compare l'horodatage de chaque champ local à l'horodatage global
de la ligne serveur — si l'édition locale du champ est postérieure à la
dernière version serveur connue, la valeur locale gagne ; sinon, la
valeur serveur gagne. Aucun champ n'est jamais perdu silencieusement :
un champ jamais modifié localement retient toujours la valeur serveur la
plus récente. Implémentation : `fusionnerClient`
(`conflict-resolution.ts`), utilisée par `fusionnerClientsEnAttente`
(`sync-engine.ts`).

Limite connue : l'horodatage par champ n'existe que côté mobile ; le
control-plane ne l'expose pas encore (une seule colonne `updatedAt` par
client). Deux appareils éditant le même champ hors-ligne, entre deux
synchronisations, peuvent donc encore se départager de façon imprécise
l'un envers l'autre (la comparaison se fait contre l'horodatage global
serveur, pas contre l'horodatage exact de l'autre appareil) — un vrai
CRDT/horodatage vectoriel serait nécessaire pour éliminer complètement
ce cas, hors périmètre de cette tranche.

### Commande créée offline — pas de conflit métier

Une commande créée hors-ligne reçoit un UUID local et une
`idempotencyKey` dès sa création (avant toute connectivité). La
synchronisation ne fait que réconcilier cet identifiant provisoire avec
l'identifiant et le numéro attribués par le serveur lors de la création
réelle — aucune donnée métier n'est en concurrence à ce stade.
Implémentation : `reconcilierIdentifiantCommande`
(`conflict-resolution.ts`, utilisée conceptuellement — l'écriture réelle
se fait directement dans `pousserCommandesEnAttente`).

## Indicateur de synchronisation (§18.4)

L'écran affichant "synchronisé / en attente / erreur / dernière
synchronisation" est différé (aucun écran mobile dans cette tranche),
mais l'état qui l'alimenterait est déjà produit par
`synchroniser()` (`sync-engine.ts`) : `ResultatSynchronisation.statut`
(`'SYNCHRONISE' | 'ERREUR'`), le détail par flux (commandes créées,
statuts poussés, opérations de caisse poussées, clients fusionnés), la
liste d'erreurs et `derniereSynchronisationAt`.

## Ce qui n'est pas encore branché

- Aucun endpoint de synchronisation dédié : le moteur pousse contre les
  routes REST déjà existantes (`POST /commandes`, `PATCH
/commandes/:id/statut`, `POST /caisse/operations`, `PATCH
/clients/:id`, `GET /clients/:id`) — pas le protocole `synchronize()`
  intégré de WatermelonDB (qui exigerait un contrat pull/push dédié côté
  API, non construit ici).
- Adaptateur SQLite natif (production) : cette tranche utilise
  uniquement l'adaptateur LokiJS en mémoire, exclusivement pour les
  tests (`db/test-adapter.ts`). Le branchement de l'adaptateur SQLite
  réel est différé à l'implémentation des écrans mobiles, qui nécessite
  de toute façon un appareil/simulateur pour être vérifiée
  correctement.
- Déclenchement automatique de la synchronisation (au retour réseau, en
  tâche de fond) : différé — `synchroniser()` est actuellement appelable
  à la demande uniquement.
