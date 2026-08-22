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

**Extension — réinitialisation de mot de passe** (demande explicite de
l'utilisateur pendant les tests locaux) : `PATCH /users/:id/mot-de-passe`,
même contrôleur, même autorité ADMIN que le reste du module. Un ADMIN peut
réinitialiser le mot de passe de n'importe quel compte de son tenant, **y
compris le sien** — aucune preuve de l'ancien mot de passe exigée, même
principe que la création (l'ADMIN définit déjà un mot de passe initial
sans justification). Écran : bouton "Réinitialiser mot de passe" par
ligne dans `UsersPage`, saisie du nouveau mot de passe via une invite
navigateur simple (`window.prompt`, même registre que la confirmation de
suppression déjà utilisée dans `ClientsPage`/`ServicesPage`).

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

## Tranche 7 — fondation console super-admin (nouveau backend)

Les 5 écrans restants (licences, facturation, audit/logs, centre de
support, tableau de bord SaaS) exigent tous une authentification
SUPER_ADMIN — or aucun flux de connexion n'existait pour ce rôle :
`LoginDto` exige un `sousDomaine` pour résoudre le tenant, et un
SUPER_ADMIN a `tenantId: null` par construction (jamais associé à un
tenant). Décision explicite avec l'utilisateur (le login super-admin est
une pièce structurelle plus grande que les deux petits ajouts backend
précédents 5/6) : construire cette fondation avant les 5 écrans, plutôt
que de les laisser inaccessibles.

- Backend : `POST /auth/super-admin/login` (email + mot de passe, sans
  sousDomaine) — recherche directe par email parmi les comptes
  `tenantId: null` et `role: SUPER_ADMIN`, jamais via l'index unique
  `(tenantId, email)` (Postgres traite chaque `NULL` comme distinct, cet
  index ne garantit pas l'unicité entre comptes SUPER_ADMIN).
  `AuthService.SessionResult.tenant` devient optionnel (absent pour une
  session SUPER_ADMIN).
- Frontend : `SuperAdminLoginPage` (`/super-admin/connexion`),
  `SuperAdminRoute` (redirige si absent ou si `role !== SUPER_ADMIN`),
  `SuperAdminShell` (jamais partagé avec `AppShell` — Constitution II,
  rôles jamais fusionnés ; pas d'identité de tenant à afficher),
  `SuperAdminDashboardPage` (`/super-admin`, `GET /super-admin/stats` :
  total tenants + répartition par statut de licence). Maquette de
  référence : `docs/design/screens/tableau_de_bord_super_admin_saas` —
  revenu récurrent mensuel, commandes globales et licences expirant
  bientôt non repris : `stats.controller.ts` ne calcule que le total de
  tenants et la répartition par statut de licence.

## Tranche 8 — liste des tenants, licences et facturation super-admin

Ajoute `SuperAdminTenantsPage` (`/super-admin/tenants`, `GET
/super-admin/tenants` : liste avec plan/statut licence/date de création)
et `SuperAdminTenantDetailPage` (`/super-admin/tenants/:id`) qui
regroupe les actions de licence (activer/renouveler/suspendre/réactiver/
révoquer via `super-admin/tenants/:id/licence/*`, idempotencyKey générée
côté client), le changement de plan (`PATCH .../plan`) et la facturation
(`GET`/`POST /super-admin/facturation/:id`, gère le cas "aucun
abonnement" — 404 — avec un formulaire de création). Regroupées sur un
seul écran de détail plutôt que deux séparés : les deux maquettes de
référence (`gestion_des_licences_super_admin`,
`facturation_abonnements_saas_tenant`) agissent toutes deux sur un même
tenant sélectionné depuis une liste — cohérent avec leur modèle
"liste puis détail".

## Tranche 9 — audit/logs et centre de support (convergence)

Dernière tranche du périmètre approuvé.

- `AuditPage` (`/audit`, sur `AppShell`, lien ADMIN uniquement) :
  `GET /audit`, tenant-scoped. Contrairement aux écrans super-admin
  voisins, cet endpoint exige un `tenantId` — un SUPER_ADMIN
  (`tenantId: null`) en est exclu par construction
  (`audit.controller.ts`) et doit passer par le mode support explicite
  ci-dessous. Maquette de référence :
  `docs/design/screens/audit_de_s_curit_et_logs_utilisateurs`.
- Section "Support" ajoutée à `SuperAdminTenantDetailPage` (plutôt qu'un
  écran séparé — même tenant sélectionné que licence/facturation/plan) :
  démarrer une session (`POST .../support/demarrer`, motif obligatoire
  ≥ 3 caractères), statut de la session active
  (`GET .../support/session`), la terminer (`POST .../support/terminer`),
  et pendant qu'elle est active, consulter le journal d'audit de ce
  tenant (`GET .../support/audit`, protégé par `SupportSessionGuard` côté
  API — aucun accès direct aux données d'un tenant sans session motivée
  et active, Constitution/cahier des charges §16). Maquette de
  référence : `docs/design/screens/centre_de_support_aide`.

Avec cette tranche, les 14 écrans du périmètre approuvé (12 initialement
prêts + 2 avec petit ajout backend + fondation console super-admin) sont
tous livrés. **015-web est convergée** pour ce périmètre.

## Périmètre définitivement hors 015-web

Exclu du périmètre approuvé, documenté pour référence future :

- Notifications (012) : aucun backend de configuration n'existe (voir
  correction de périmètre tranche 4) — nécessiterait une nouvelle spec
  backend avant tout écran.
- 8 maquettes sans backend existant (stocks/consommables,
  multi-boutiques réseau, RH/rotations, maintenance machines, transfert
  de stock, tarification par zone géographique) — hors périmètre tant
  qu'aucune spec backend ne les couvre, décision explicite avec
  l'utilisateur.
- Écrans mobiles des maquettes (caissier, portail client, technicien/
  livreur) — traités dans la phase mobile, après convergence web.
- Navigation filtrée par rôle au-delà de la redirection non-authentifiée
  et des quelques liens ADMIN déjà filtrés (ex. LIVREUR ne devrait voir
  qu'un sous-ensemble de la navigation) — affichage seulement, jamais
  une autorisation.
- Vérification navigateur interactive complète : cet environnement ne
  dispose ni d'un outil de contrôle de navigateur, ni d'un PostgreSQL
  local (les tests d'intégration de ce projet ne s'exécutent réellement
  qu'en CI, cf. tous les specs précédents). Vérifié à la place : suite de
  composants (55 tests, API simulée), `tsc --noEmit`, build de
  production Vite réussi. Un passage manuel en navigateur reste
  recommandé avant mise en production.
- Pas de gestion de token expiré/refresh (401 renvoie une erreur brute
  pour l'instant, pas de redirection automatique vers `/connexion`).

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec (périmètre approuvé livré en
      entier — voir tranches 1 à 9).
- [x] Tests unitaires/composants (55 tests couvrant les 14 écrans, dont
      `api-client`, `auth-context`, `ProtectedRoute`/`SuperAdminRoute`,
      `App` routing, `AppShell`).
- [ ] Tests intégration (pas de suite E2E navigateur dans ce projet à ce
      stade — hors périmètre de cette tranche).
- [x] Tests sécurité/RBAC (le frontend ne fait qu'un affichage
      conditionnel ; le RBAC réel est déjà testé côté API pour chaque
      endpoint consommé).
- [ ] Tests tenant isolation (non applicable côté frontend — l'isolation
      est déjà garantie et testée côté API).
- [x] Documentation mise à jour.
