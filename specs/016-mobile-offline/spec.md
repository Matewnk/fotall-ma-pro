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

## Tranche 2 — fondation des écrans (navigation, auth)

Décision explicite avec l'utilisateur : construire les écrans malgré
l'absence d'émulateur/simulateur dans cet environnement (comme pour
015-web), vérifiés uniquement par composants (React Native Testing
Library) + `tsc --noEmit` + build — jamais de vérification visuelle
réelle possible ici ; un passage manuel sur appareil/simulateur reste
nécessaire avant mise en production.

- **Dépendances ajoutées** : `@react-navigation/native` +
  `@react-navigation/native-stack` **v6** (pas v7 : `react-native-screens`
  pinné par Expo SDK 51 est v3.x, incompatible avec le peer `>=4.0.0`
  exigé par `@react-navigation/native-stack` v7),
  `@react-native-async-storage/async-storage`, `react-native-screens`,
  `react-native-safe-area-context` (versions résolues par `expo install`
  pour SDK 51).
- **Tests de composants** : `jest-expo` + `@testing-library/react-native`
  **v12** (v13/v14 exigent React 19 / RN ≥0.78, ce projet est verrouillé
  sur React 18.2/RN 0.74.5). `jest.config.js` passe en configuration
  `projects` : le projet `offline` (ts-jest, inchangé) cohabite avec un
  nouveau projet `screens` (jest-expo, `**/*.test.tsx`).
  **`transformIgnorePatterns` de jest-expo réécrit** : le motif par
  défaut (`node_modules/(?!pkg)`) suppose une structure à plat ; pnpm
  imbrique chaque paquet sous `node_modules/.pnpm/pkg@version/node_modules/pkg/`,
  et le premier segment `node_modules/.pnpm/` matche déjà le motif
  d'exclusion avant d'atteindre le vrai nom de paquet — react-native et
  ses dépendances (Flow typé) n'étaient jamais transformées, causant des
  `SyntaxError`. Motif réécrit pour chercher le nom de paquet n'importe
  où plus loin dans le chemin plutôt qu'immédiatement après
  "node_modules/".
- **`Pressable` préféré à `TouchableOpacity`** : ce dernier enveloppe un
  `Animated.Value` interne dont les mises à jour asynchrones fuient hors
  du rendu de test (avertissement React "not wrapped in act(...)"),
  ralentissant les tests (~6s au lieu de ~200ms par test observé).
- **Timeouts `waitFor` portés à 5000ms** (défaut RNTL : 1000ms) : le
  projet `screens` (jest-expo) tournant en parallèle du projet `offline`
  (WatermelonDB/LokiJS, cold-start lui-même lent — gotcha déjà documenté
  tranche 1) sous contention CPU a occasionnellement dépassé le défaut,
  provoquant un test intermittent (échec observé ~1 fois sur 6 lors du
  diagnostic, stable sur 6 exécutions consécutives après correction).
- **`apps/mobile/src/lib/*`** : `api-client.ts` (équivalent mobile de
  `apps/web/src/lib/api-client.ts`, même contrat `apiFetch`/`ApiError`),
  `auth-context.tsx` (équivalent web, mais `AsyncStorage` est asynchrone
  — contrairement à `localStorage`, d'où un état `chargement` absent de
  la version web), `types.ts`.
- **Écrans** : `LoginScreen` (connexion staff — sous-domaine + email +
  mot de passe, même contrat `POST /auth/login` que le web), `AccountScreen`
  (atterrissage post-connexion : identité tenant/utilisateur, déconnexion).
- **`RootNavigator`** : équivalent mobile de `ProtectedRoute` (web),
  adapté au modèle de pile de React Navigation plutôt qu'aux routes URL
  — affichage seulement, jamais une garantie de sécurité.
- **Le moteur de synchronisation offline (tranche 1) n'est pas encore
  branché sur ces écrans** : `LoginScreen`/`AccountScreen` appellent
  l'API REST directement en ligne (comme le web), pas via
  `offline/sync-engine.ts`. Le brancher sur un écran réellement
  offline-first (ex. nouvelle commande CAISSIER) est différé à la
  tranche qui construira cet écran.

## Périmètre différé

- **Écrans métier** : nouvelle commande CAISSIER (mockup
  `interface_caissier_nouvelle_commande_mobile`, backend déjà prêt —
  `POST /commandes`, 009) et suivi TECHNICIEN/LIVREUR (mockup
  `suivi_technicien_livreur_mobile`, backend déjà prêt — `PATCH
/commandes/:id/statut`, 009) — PRs séparées, sur la fondation de cette
  tranche.
- **Portail client** (mockup `portail_client_suivi_de_commande_mobile`) :
  écran public, sans connexion (numéro de commande + téléphone). Décision
  explicite avec l'utilisateur : nécessite un nouveau endpoint public non
  authentifié (aucun n'existe — tout le reste de l'API exige un JWT
  staff) — backend et écran différés à une PR dédiée.
- **Branchement du moteur de synchronisation offline** sur un écran
  réellement offline-first (voir ci-dessus).
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

- [x] Fonctionnalité conforme à la spec (couche de données offline +
      fondation des écrans livrées).
- [x] Tests unitaires/composants : `conflict-resolution.spec.ts` (9
      tests), `sync-engine.spec.ts` (12 tests, vrai `Database`
      WatermelonDB en mémoire), `LoginScreen.test.tsx` +
      `AccountScreen.test.tsx` (3 tests, React Native Testing Library) —
      24 au total.
- [ ] Tests intégration (pas d'appel réseau réel — le moteur offline est
      testé contre un `ApiClient` simulé, les écrans contre un `fetch`
      simulé ; l'intégration avec l'API réelle sera testée lors du
      passage manuel sur appareil/simulateur).
- [x] Tests sécurité/RBAC (non applicable ici — aucune nouvelle route
      API, le RBAC des endpoints consommés est déjà testé dans leurs
      specs respectives, 007/009/010).
- [ ] Tests tenant isolation (une base locale appartient à un seul
      tenant — pas de scénario multi-tenant à tester côté mobile).
- [x] Documentation mise à jour (`docs/sync-conflict-strategy.md` créé).
