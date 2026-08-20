# Web — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Web** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

## Références

- `docs/cahier-des-charges.md`
- `.specify/memory/constitution.md`
- `docs/architecture/architecture.md`
- `docs/testing/test-strategy.md`
- `docs/design/DESIGN.md` (tokens visuels), `docs/design/screens/*` (maquettes de référence)

## Exigences

- Les autorisations sont vérifiées côté serveur.
- Toute donnée tenant-scoped est strictement isolée.
- Les jobs et exports conservent le contexte tenant.
- Les opérations critiques sont idempotentes.

## Mécanisme implémenté

**Première tranche verticale (MVP)**, décision explicite pour ne pas
livrer un seul PR massif couvrant tous les écrans : authentification +
tableau de bord + commandes (liste + création), en établissant
l'architecture frontend que les écrans suivants (clients, services,
caisse, tickets, rapports, administration, licence) réutiliseront.

- **Stack ajoutée** (React + Vite déjà verrouillé) : `react-router-dom`
  (routage), `@tanstack/react-query` (cache/état de chargement des appels
  API), Tailwind CSS v4 via `@tailwindcss/vite` (tokens de
  `docs/design/DESIGN.md` portés dans `src/index.css` via `@theme`).
- **`api-client.ts`** : point d'entrée HTTP unique, injecte le Bearer
  token, normalise les erreurs Nest (`{statusCode, message, error}`) en
  `ApiError`.
- **`auth-context.tsx`** : session (token + tenant + user) en mémoire,
  persistée dans `localStorage` pour survivre à un rechargement — jamais
  de logique d'autorisation ici, uniquement de l'affichage conditionnel
  (le frontend n'est jamais une autorité de sécurité, chaque appel API
  revalide indépendamment JWT + rôle côté serveur).
- **Écrans** : connexion, inscription (essai 15 jours), tableau de bord
  (KPIs/alertes/commandes récentes du `GET /dashboard`, 013), commandes
  (liste + création via `GET`/`POST /commandes`, 009).
- **CORS** activé côté API (`app.enableCors()`, `main.ts`) — nécessaire
  dès qu'un frontend tourne sur une origine différente ; authentification
  par Bearer token (jamais de cookie), donc `credentials: false`.
- **Fidélité visuelle** : tokens de couleur/typographie/espacement de
  `docs/design/DESIGN.md` portés fidèlement (Tailwind `@theme`), polices
  Google Fonts (Inter, JetBrains Mono, Material Symbols Outlined) comme
  dans les maquettes. Structure de page (barre latérale + en-tête,
  grille de cartes KPI, tableau des commandes récentes) inspirée de
  `docs/design/screens/tableau_de_bord_administrateur_tenant_1`, adaptée
  librement pour React + données réelles (pas un portage pixel-perfect
  du HTML).

## Tranche 2 — clients, tarifs/services

Ajoute deux écrans CRUD complets réutilisant l'architecture MVP sans la
modifier : `ClientsPage` (007-customers : liste filtrable par nom,
création, édition, suppression avec confirmation) et `ServicesPage`
(008-services : liste, KPI dérivés — services actifs/catégories —,
création, édition, suppression). Maquettes de référence :
`docs/design/screens/gestion_des_clients_et_fid_lit` et
`configuration_des_tarifs_tenant_admin` — fidélité/points/palier de la
première maquette non repris (aucun champ correspondant côté API).

## Tranche 3 — caisse, tickets

Ajoute `CashPage` (010-cash : solde en caisse, journal des opérations en
lecture, enregistrement d'une nouvelle opération — jamais d'édition ni de
suppression, le journal est append-only par construction, Constitution
IV) et `TicketsPage` (011-tickets-printing : réimpression/téléchargement
du ticket PDF ou ESC/POS 58mm/80mm d'une commande existante). Maquettes
de référence : `journal_de_caisse_et_rapports_financiers` et
`gestion_de_l_impression_thermique` — cette dernière suppose un parc
d'imprimantes réseau surveillé (état matériel, file de jobs) qui n'a
aucun backend ; adapté à ce qui existe réellement (génération de ticket à
la demande pour une commande donnée). Ajout de `apiFetchBlob` dans
`api-client.ts` pour les réponses binaires (PDF/ESC-POS), à côté de
`apiFetch` (JSON) — même contrat d'auth/erreur.

## Tranche 4 — rapports

Ajoute `ReportsPage` (014-reports) : sélecteur parmi les 8 rapports
exposés par l'API, filtre de plage de dates pour les rapports qui le
supportent, tableau générique (colonnes/lignes), cartes de résumé quand
le rapport en fournit un, export CSV/PDF (réutilise `apiFetchBlob` de la
tranche 3). Maquette de référence :
`docs/design/screens/statistiques_avanc_es_rentabilit` — celle-ci
présente des graphiques et des KPI (marge nette, coût d'acquisition
client, valeur moyenne de commande) qu'aucun rapport ne calcule côté
API : l'API expose un contrat tabulaire générique unique
(`TableauRapport`, `reports.types.ts`), adapté fidèlement à ce contrat
plutôt qu'à des métriques inventées.

**Correction de périmètre** : la maquette
`configuration_des_tickets_et_notifications` avait été classée comme
"couverte par une API existante" lors du cadrage initial de cette spec.
Vérification faite à l'implémentation : le module `notifications`
(012) n'expose aucun contrôleur HTTP — c'est un pur listener d'événements
internes, les templates de message sont codés en dur globalement
(`notification-templates.ts`, explicitement noté "configurable par
tenant dans une future spec si besoin" — pas encore fait). Aucun écran
de configuration n'est donc possible sans un nouveau backend ; retirée
de la liste "prête" et déplacée ci-dessous.

## Tranche 5 — utilisateurs et rôles (nouveau backend)

Ajoute `UsersPage` (§2.1 "ADMIN gère les utilisateurs") et le backend qui
manquait pour la rendre possible : `apps/api/src/users/*`
(`UsersController`/`UsersService`, `@Controller('users')`, ADMIN
uniquement, aucun `LicenceActiveGuard` — administrer les comptes doit
rester possible même tenant bloqué). Aucune migration Prisma requise
(`User` existe déjà au plan de contrôle depuis 002).

- `POST /users` : création (email + mot de passe provisoire + rôle),
  rôle limité à `ADMIN|CAISSIER|TECHNICIEN|LIVREUR` (jamais
  `SUPER_ADMIN` — un ADMIN ne peut jamais créer un compte plateforme).
- `GET /users` : liste scopée au tenant, hash jamais exposé.
- `PATCH /users/:id` : changement de rôle et/ou activation/désactivation.
  Jamais de suppression : un compte désactivé conserve son historique
  dans les journaux existants (`OperationCaisse.operateurId`,
  `AuditLog.actorId`, ...) — supprimer casserait ces références. Un
  ADMIN ne peut pas se désactiver lui-même (verrou anti-lockout minimal).
- `AppShell` : premier lien de navigation réellement filtré par rôle
  (`/utilisateurs`, ADMIN uniquement) — affichage seulement, le RBAC réel
  reste appliqué côté API à chaque requête.

Maquette de référence : `docs/design/screens/gestion_des_utilisateurs_et_r_les`
— "dernière connexion" non repris (aucun champ de ce type sur `User`).

## Tranche 6 — branding (nouveau backend)

Ajoute `BrandingPage` et le backend qui manquait pour la rendre possible :
`apps/api/src/tenant-settings/*` (`TenantSettingsController`/`Service`,
`@Controller('tenant')`, ADMIN uniquement, aucun `LicenceActiveGuard` —
consulter/corriger ces informations doit rester possible même tenant
bloqué). Aucune migration Prisma requise (les champs existent déjà sur
`Tenant` depuis 002).

- `GET /tenant`, `PATCH /tenant` : nom, adresse, téléphone, logo (URL),
  langue, devise, fuseau horaire. `sousDomaine` (routage de connexion) et
  `plan` (géré par 017/super-admin) volontairement exclus du DTO — non
  éditables en self-service.

Maquette de référence : `docs/design/screens/personnalisation_du_branding`
— email de contact, upload de fichier logo et couleur d'accent non
repris : aucun champ correspondant sur `Tenant`, et aucun backend de
stockage de fichiers n'existe dans ce projet (`docs/production-checklist.md`).
`logoUrl` reste une simple URL texte, jamais un upload.

## Périmètre différé

Cette spec **n'est pas convergée** : tranche MVP (connexion, inscription,
tableau de bord, commandes) + tranche 2 (clients, tarifs/services) +
tranche 3 (caisse, tickets) + tranche 4 (rapports) + tranche 5
(utilisateurs/rôles) + tranche 6 (branding) livrées. Restent à faire, en
PRs séparées réutilisant cette même architecture :

- Écrans facturation/abonnement (017), licences super-admin (004/005),
  audit/logs (018), centre de support (005), tableau de bord super-admin
  (005).
- Notifications (012) : aucun backend de configuration n'existe (voir
  correction de périmètre ci-dessus) — nécessiterait une nouvelle spec
  backend avant tout écran.
- 8 maquettes sans backend existant (stocks/consommables,
  multi-boutiques réseau, RH/rotations, maintenance machines, transfert
  de stock, tarification par zone géographique) — hors périmètre tant
  qu'aucune spec backend ne les couvre, décision explicite avec
  l'utilisateur.
- Écrans mobiles des maquettes (caissier, portail client, technicien/
  livreur) — traités dans la phase mobile, après convergence web.
- Navigation filtrée par rôle au-delà de la redirection non-authentifiée
  (ex. LIVREUR ne devrait voir qu'un sous-ensemble de la navigation) —
  affichage seulement, jamais une autorisation.
- Vérification navigateur interactive complète : cet environnement ne
  dispose ni d'un outil de contrôle de navigateur, ni d'un PostgreSQL
  local (les tests d'intégration de ce projet ne s'exécutent réellement
  qu'en CI, cf. tous les specs précédents). Vérifié à la place : suite de
  composants (15 tests, API simulée), `tsc --noEmit`, build de
  production Vite réussi, et un test de fumée du serveur de dev (démarrage
  réel, transformation sans erreur de `main.tsx`/`App.tsx`/`index.css`).
  Un passage manuel en navigateur reste recommandé avant mise en
  production.
- Pas de gestion de token expiré/refresh (401 renvoie une erreur brute
  pour l'instant, pas de redirection automatique vers `/connexion`).

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec (pour le périmètre MVP livré).
- [x] Tests unitaires/composants (15 tests : `api-client`, `auth-context`,
      `ProtectedRoute`, `App` routing, `DashboardPage`, `OrdersPage`).
- [ ] Tests intégration (pas de suite E2E navigateur dans ce projet à ce
      stade — hors périmètre de cette tranche).
- [x] Tests sécurité/RBAC (le frontend ne fait qu'un affichage
      conditionnel ; le RBAC réel est déjà testé côté API pour chaque
      endpoint consommé).
- [ ] Tests tenant isolation (non applicable côté frontend — l'isolation
      est déjà garantie et testée côté API).
- [x] Documentation mise à jour.
