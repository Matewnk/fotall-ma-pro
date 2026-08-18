# Fotall-Ma Pro — Instructions de pilotage Claude Code + Spec Kit

**Version : 2.0**  
**Date : 17 août 2026**  
**Document compagnon du cahier des charges v2.0**

> Ne colle pas toutes les étapes dans Claude Code en une seule fois.
> Exécute une feature à la fois et ne passe à la suivante qu'après validation
> de ses tests et de ses quality gates.

---

# 0. Règles absolues à donner à Claude Code

Crée à la racine du repository un `CLAUDE.md`.

```markdown
# Fotall-Ma Pro — Contexte permanent

## Produit

Application SaaS multi-tenant de gestion de pressing :
dépôt, clients, commandes, traitement, livraison/retrait, notifications,
tickets, caisse, rapports, Web, mobile et tablette.

## Modèle commercial

- Essai gratuit : 15 jours.
- Le calcul commence à la création du tenant, avec l'horloge serveur.
- La licence payante et son état sont contrôlés côté serveur.
- Le Super-Administrateur SaaS pilote les tenants, licences, abonnements et
  facturation globale.

## Rôles — ne jamais les fusionner

SUPER_ADMIN
- plateforme SaaS ;
- tenants ;
- licences ;
- abonnements ;
- facturation ;
- support.

ADMIN
- un seul tenant ;
- configuration ;
- utilisateurs ;
- services ;
- tarifs ;
- rapports.

CAISSIER
- commandes ;
- paiements ;
- tickets ;
- caisse.

TECHNICIEN
- statuts de traitement autorisés.

LIVREUR
- livraisons du jour et statut de livraison.

## Règle de sécurité n°1

Aucune donnée d'un tenant ne doit jamais être visible, exportable, modifiable
ou devinable par un autre tenant.

Chaque requête, job, événement, cache key, fichier, export et audit
tenant-scoped DOIT être associé au tenant context.

Un tenant_id envoyé par le client ne constitue jamais une preuve d'appartenance.

## Architecture V1

- Monorepo pnpm + Turborepo.
- Backend NestJS + TypeScript.
- Prisma + PostgreSQL 16.
- Schéma PostgreSQL dédié par tenant.
- Redis.
- React + Vite.
- React Native + Expo.
- SQLite/WatermelonDB pour offline.
- REST + OpenAPI.
- FCM + WhatsApp Business + SMS.
- ESC/POS + PDF.
- Stripe ou passerelle Mobile Money approuvée.
- GitHub Actions.
- Docker.

## Règles d'ingénierie

- TypeScript strict.
- Server-side authorization.
- Aucun accès tenant-scoped sans TenantContext.
- Aucune opération financière destructive.
- Synchronisation idempotente.
- Statut commande monotone.
- Secrets absents des logs.
- Tests obligatoires.
- Pas de dépendance sans justification.
- Pas de changement architectural silencieux.
- Pas de nouvelle fonctionnalité hors spec approuvée.

## Workflow obligatoire

constitution → specify → clarify → plan → checklist → tasks → analyze →
implement → converge

## Documents de référence

- docs/cahier-des-charges.md
- .specify/memory/constitution.md
- docs/architecture/architecture.md
- docs/testing/test-strategy.md
- specs/NNN-*/spec.md
```

---

# 1. Préparer Spec Kit

Utilise la version actuelle de Spec Kit et son intégration Claude Code.

```bash
uv tool install specify-cli
specify version
specify init . --integration claude
```

Ne commence pas l'implémentation métier avant d'avoir :

- le repository ;
- `constitution.md` ;
- le cahier des charges v2 ;
- l'architecture ;
- la stratégie de tests ;
- les specs découpées.

---

# 2. Constitution

Le fichier `.specify/memory/constitution.md` doit contenir au minimum ces
principes :

1. isolation tenant comme frontière de sécurité ;
2. séparation SUPER_ADMIN / ADMIN tenant ;
3. licence serveur-authoritative ;
4. essai 15 jours ;
5. offline critique et idempotence ;
6. RBAC serveur ;
7. caisse append-only ;
8. contrats API centralisés ;
9. tests avant progression ;
10. audit, observabilité et restauration ;
11. changements petits et réversibles.

Si une implémentation entre en conflit avec la Constitution, la Constitution
gagne.

---

# 3. Architecture technique à figer

## 3.1 Repository

```text
fotall-ma-pro/
├── CLAUDE.md
├── docs/
│   ├── cahier-des-charges.md
│   ├── architecture/
│   ├── testing/
│   └── security/
├── .specify/
│   └── memory/
├── specs/
│   ├── 001-foundation/
│   ├── 002-identity-tenancy/
│   ├── 003-tenant-isolation/
│   ├── 004-licensing/
│   ├── 005-super-admin/
│   ├── 006-onboarding/
│   ├── 007-customers/
│   ├── 008-services/
│   ├── 009-orders/
│   ├── 010-cash/
│   ├── 011-tickets-printing/
│   ├── 012-notifications/
│   ├── 013-dashboard/
│   ├── 014-reports/
│   ├── 015-web/
│   ├── 016-mobile-offline/
│   ├── 017-billing/
│   ├── 018-audit-security/
│   ├── 019-open-api/
│   └── 020-production/
├── apps/
│   ├── api/
│   ├── web/
│   └── mobile/
├── packages/
│   ├── shared-types/
│   └── ui-kit/
└── infra/
    └── docker-compose.yml
```

## 3.2 Tenant context

Le backend doit établir un contexte contenant au minimum :

```ts
type TenantContext = {
  tenantId: string;
  userId?: string;
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'CAISSIER' | 'TECHNICIEN' | 'LIVREUR';
  supportSessionId?: string;
};
```

Les repositories tenant-scoped exigent ce contexte.

---

# 4. Workflow Spec Kit obligatoire

Pour chaque feature :

## Étape A — Specify

```text
/speckit.specify
```

Lire la spec correspondante dans `specs/NNN-*/spec.md`.

Ne pas inventer de fonctionnalités.

## Étape B — Clarify

```text
/speckit.clarify
```

Identifier seulement les ambiguïtés qui peuvent modifier :

- modèle de données ;
- permissions ;
- sécurité ;
- états ;
- intégrations ;
- offline ;
- comportement d'erreur.

## Étape C — Plan

```text
/speckit.plan
```

Le plan doit respecter la Constitution et l'architecture.

## Étape D — Checklist

```text
/speckit.checklist
```

Créer une checklist de qualité, sécurité et acceptation.

## Étape E — Tasks

```text
/speckit.tasks
```

Découper en petites tâches testables.

## Étape F — Analyze

```text
/speckit.analyze
```

Vérifier la cohérence entre :

- spec ;
- plan ;
- tasks ;
- Constitution ;
- architecture ;
- contrats.

## Étape G — Implement

```text
/speckit.implement
```

Implémenter seulement les tâches approuvées.

## Étape H — Converge

```text
/speckit.converge
```

Vérifier que l'implémentation correspond réellement aux exigences.

---

# 5. PROMPT 1 — Foundation

```text
Initialise Fotall-Ma Pro comme monorepo pnpm + Turborepo.

Crée :
- apps/api : NestJS + TypeScript strict + Prisma
- apps/web : React + Vite + TypeScript
- apps/mobile : React Native + Expo + TypeScript
- packages/shared-types
- packages/ui-kit
- infra/docker-compose.yml avec PostgreSQL 16 et Redis

Ajoute :
- ESLint
- Prettier
- scripts dev/build/test/lint/typecheck
- GitHub Actions
- configuration d'environnement documentée

Ne code aucune fonctionnalité métier.

Vérifie :
pnpm install
pnpm lint
pnpm typecheck
pnpm build
pnpm test

Ne considère la tâche terminée que si les commandes passent.
```

---

# 6. PROMPT 2 — Identity & Tenancy

```text
Implémente l'identité et le contexte tenant.

Entités minimales :
Tenant
- id
- nom_pressing
- sous_domaine
- plan
- statut_licence
- langue
- devise
- fuseau_horaire
- created_at

Utilisateur
- id
- tenant_id
- role
- email
- mot_de_passe_hash
- pin_hash optionnel
- actif
- timestamps

JWT :
- user_id
- tenant_id
- role

Le tenant est résolu par sous-domaine et/ou contexte d'authentification.
Le serveur vérifie toujours l'appartenance user → tenant.

Implémente un TenantContext global.

Toute requête tenant-scoped sans contexte valide doit être rejetée.

Écris les tests de création, login, appartenance et rejet d'un tenant falsifié.
```

---

# 7. PROMPT 3 — Tenant Isolation — GATE ABSOLU

```text
Implémente et prouve l'isolation multi-tenant avant toute fonctionnalité
métier supplémentaire.

V1 :
- PostgreSQL control-plane ;
- schéma PostgreSQL dédié par tenant ;
- résolution de schéma via TenantContext.

Crée les fixtures Tenant A et Tenant B.

Avec un utilisateur A, tente :
1. GET d'une ressource B par ID ;
2. LIST ;
3. SEARCH par nom ;
4. SEARCH par téléphone ;
5. UPDATE ;
6. DELETE ;
7. EXPORT ;
8. REPORT ;
9. CACHE ;
10. QUEUE JOB ;
11. OBJECT STORAGE ;
12. AUDIT.

Toutes les tentatives doivent être refusées ou retourner un résultat vide
correctement scoped.

Teste également :
- tenant_id forgé dans JWT ;
- tenant_id forgé dans URL/body ;
- job sans tenant_id ;
- job avec tenant_id différent ;
- clé API d'un tenant utilisée contre un autre tenant.

Crée docs/security/tenant-isolation.md.

Aucun passage à la spec suivante si un test d'isolation est rouge.
```

---

# 8. PROMPT 4 — Licences et essai de 15 jours

```text
Implémente le module de licence.

Machine :
CREATION → ESSAI
ESSAI → ACTIVE
ESSAI → EXPIREE
ACTIVE → SUSPENDUE
SUSPENDUE → ACTIVE
révocation définitive selon politique → EXPIREE

Durée :
date_fin_essai = date_debut_essai + 15 jours.

Cette date :
- est calculée par le serveur ;
- n'est jamais fournie par le client ;
- n'est jamais recalculée à partir de l'appareil.

Modèle :
Licence
- id
- tenant_id unique
- statut
- date_debut_essai
- date_fin_essai
- date_activation
- date_expiration_courante
- cle_licence_jwt
- derniere_verification_at

JournalLicence append-only :
- tenant_id
- licence_id
- evenement
- effectue_par
- motif si action manuelle
- created_at

Endpoints :
GET /licence/statut
POST /super-admin/tenants/:id/licence/activer
POST /super-admin/tenants/:id/licence/renouveler
POST /super-admin/tenants/:id/licence/suspendre
POST /super-admin/tenants/:id/licence/reactiver
POST /super-admin/tenants/:id/licence/revoquer

ADMIN tenant → 403 sur tous les endpoints Super-Admin.

Ajoute :
- job d'expiration ;
- événement 48h avant fin d'essai ;
- LicenceActiveGuard pour les écritures ;
- idempotence ;
- audit ;
- rotation de clé de licence lors des changements prévus.

Tests obligatoires :
- création → J+15 ;
- expiration automatique ;
- horloge client ignorée ;
- écriture bloquée ;
- ADMIN → 403 ;
- motif obligatoire ;
- journal ;
- idempotence.
```

---

# 9. PROMPT 5 — Super-Admin

```text
Implémente le back-office SaaS /super-admin.

Fonctionnalités :
- tenants ;
- plans ;
- licences ;
- abonnements ;
- facturation ;
- statistiques globales ;
- support.

Le rôle SUPER_ADMIN est distinct des rôles tenant.

Un accès détaillé aux données d'un tenant exige :
- tenant sélectionné ;
- mode support explicite ;
- motif obligatoire ;
- audit début ;
- audit fin ;
- bannière visible dans l'UI.

Ne crée pas de "super ADMIN" qui serait simplement un ADMIN avec plus de
permissions.
```

---

# 10. PROMPT 6 — Onboarding

```text
Crée un onboarding en 3 étapes pour le premier ADMIN :

1. Identité du pressing :
nom, logo, adresse, téléphone, devise, langue.

2. Tarifs :
catalogue standard pré-rempli ou grille vierge.

3. Premier utilisateur et notification :
confirmation du compte et test de canal.

L'onboarding est reprenable et ne bloque jamais l'application.

Stocke :
- étape courante ;
- étapes terminées ;
- timestamps.

Teste l'abandon à l'étape 2 et la reprise.
```

---

# 11. PROMPT 7 — Clients

```text
Implémente les clients dans le tenant courant.

Champs :
nom, téléphone obligatoire, email, adresse,
canal notification, statut, notes, timestamps.

Fonctions :
CRUD, recherche, historique commandes.

Tests :
- validation ;
- permissions ;
- tenant isolation ;
- recherche ;
- export scoped.
```

---

# 12. PROMPT 8 — Services et tarifs

```text
Implémente le catalogue de services propre au tenant.

Champs :
code, intitulé, catégorie, délai, tarif, actif.

Prépare les codes :
SRV-01 à SRV-08
LIV-01 à LIV-02

Le tarif d'un tenant ne doit jamais apparaître dans un autre tenant.

Teste :
- CRUD ;
- permissions ;
- isolation ;
- validation tarif ;
- onboarding.
```

---

# 13. PROMPT 9 — Commandes

```text
Implémente les commandes.

Commande :
client, articles, services, quantités, prix, remise, total,
date prévue, retrait/livraison, adresse livraison, notes, statut.

Cycle :
EN_ATTENTE → EN_COURS → PRET → LIVRE

Interdire toute régression.

Calculer les totaux côté serveur.

Tester :
- création ;
- calcul ;
- remise ;
- transitions ;
- permissions ;
- isolation ;
- idempotency key.
```

---

# 14. PROMPT 10 — Caisse

```text
Implémente la caisse comme journal append-only.

Opérations :
OUVERTURE, ENCAISSEMENT, AVANCE, DEPENSE, REMBOURSEMENT,
AJUSTEMENT_COMPENSATOIRE, CLOTURE.

Aucune correction destructive.

Chaque événement possède :
tenant_id, opérateur, type, montant, référence, timestamp,
mode paiement, idempotency key.

Le solde doit être déterministe.

Teste :
- deux caissiers ;
- doublon réseau ;
- remboursement ;
- clôture ;
- permissions ;
- isolation.
```

---

# 15. PROMPT 11 — Tickets et impression

```text
Implémente le ticket :
numéro, client, articles, services, montant, date prévue,
QR/barcode, retrait/livraison.

Formats :
PDF, ESC/POS 58mm, ESC/POS 80mm.

En offline :
numéro provisoire clairement marqué.

Teste génération PDF et payload ESC/POS sans dépendre d'une imprimante réelle.
```

---

# 16. PROMPT 12 — Notifications

```text
Implémente un système d'événements interne.

Événements :
commande créée,
commande en cours,
commande prête,
livraison prévue,
commande livrée,
licence proche expiration.

Adapters :
FCM,
WhatsApp Business,
SMS.

Le domaine métier ne doit pas appeler directement un fournisseur.

Ajoute :
- templates ;
- retry ;
- idempotence ;
- journal ;
- dry-run ;
- tenant scoping.

Teste les adapters avec des mocks.
```

---

# 17. PROMPT 13 — Dashboard

```text
Construis le dashboard tenant.

KPIs :
commandes jour,
CA jour,
articles en attente,
livraisons du jour,
retards,
revenus 7 jours.

Toutes les requêtes doivent être tenant-scoped.

Teste les agrégations avec deux tenants et prouve qu'elles ne se mélangent pas.
```

---

# 18. PROMPT 14 — Rapports et exports

```text
Implémente :
- caisse ;
- activité ;
- recettes par service ;
- top clients ;
- services ;
- livraisons/retraits ;
- retards.

Exports :
CSV, Excel, PDF.

Les gros exports passent par une queue.

Le job d'export contient tenant_id et refuse toute exécution sans contexte.

Teste l'export cross-tenant.
```

---

# 19. PROMPT 15 — Web

```text
Construis l'application Web.

Espaces :
- tenant ;
- super-admin.

Routing protégé par rôle.

Écrans tenant :
dashboard,
clients,
services,
commandes,
caisse,
rapports,
paramètres.

Écrans Super-Admin :
tenants,
licences,
plans,
abonnements,
facturation,
support.

Le frontend ne doit jamais être considéré comme la couche d'autorisation.
```

---

# 20. PROMPT 16 — Mobile / Offline-first

```text
Construis apps/mobile avec SQLite/WatermelonDB ou abstraction équivalente.

Opérations offline :
- création commande ;
- caisse ;
- statuts ;
- consultations déjà synchronisées.

Chaque mutation :
tenant_id,
device_id,
UUID local,
idempotency key,
timestamp.

Règles :
1. caisse = événements append-only ;
2. statut = état le plus avancé ;
3. client = fusion champ par champ ;
4. commande offline = réconciliation ID.

Créer docs/sync-conflict-strategy.md.

Tests obligatoires :
- deux caissiers offline ;
- synchronisation dans ordre inverse ;
- opération arrivée après clôture ;
- PRET après LIVRE ;
- modification téléphone/adresse concurrente ;
- replay du même événement.
```

---

# 21. PROMPT 17 — Billing

```text
Intègre Stripe ou la passerelle Mobile Money retenue.

Le back-office Super-Admin reste la source de décision sur les licences.

Gérer :
- plans ;
- souscriptions ;
- paiements ;
- webhooks ;
- échecs ;
- relances ;
- activation ;
- suspension.

Chaque webhook est idempotent.

Un tenant ne peut pas falsifier son état de licence via un endpoint public.

Teste :
- paiement réussi ;
- paiement échoué ;
- webhook dupliqué ;
- mauvais tenant ;
- réactivation ;
- suspension.
```

---

# 22. PROMPT 18 — Audit et sécurité

```text
Effectue le durcissement sécurité.

Vérifie :
- HTTPS ;
- hash mots de passe/PIN ;
- expiration sessions ;
- validation entrées ;
- rate limiting ;
- audit ;
- secrets ;
- permissions ;
- tenant isolation.

Teste :
- ID forgé ;
- JWT tenant falsifié ;
- API key cross-tenant ;
- export cross-tenant ;
- queue cross-tenant ;
- fichier cross-tenant ;
- support mode sans motif ;
- données sensibles dans les logs.
```

---

# 23. PROMPT 19 — API ouverte

```text
Expose une API REST documentée OpenAPI.

API keys :
- tenant unique ;
- scopes ;
- révocation ;
- quotas.

Webhooks :
- commande créée ;
- statut ;
- paiement.

Une clé du tenant A ne doit jamais pouvoir interroger B.

Ajoute tests de quota, scope et isolation.
```

---

# 24. PROMPT 20 — Production

```text
Prépare la production.

Docker :
- API ;
- web ;
- services nécessaires.

CI/CD :
- lint ;
- typecheck ;
- unit ;
- integration ;
- build.

Monitoring :
- erreurs ;
- queues ;
- licences ;
- synchronisation ;
- notifications.

Backup :
- PostgreSQL ;
- restauration tenant par tenant.

Effectue une recette finale avec le cahier des charges v2.

Aucune mise en production si :
- un test d'isolation est rouge ;
- un test RBAC critique est rouge ;
- un test licence est rouge ;
- un test financier est rouge ;
- un test offline critique est rouge.
```

---

# 25. Stratégie de tests obligatoire

## 25.1 Tests unitaires

- licence ;
- totaux ;
- transitions ;
- permissions ;
- caisse ;
- conflits offline ;
- notifications.

## 25.2 Intégration

- PostgreSQL ;
- Prisma ;
- Redis ;
- queues ;
- licence ;
- billing ;
- repositories.

## 25.3 E2E

Parcours critique :

```text
création tenant
→ essai
→ onboarding
→ client
→ commande
→ ticket
→ paiement
→ traitement
→ notification
→ prêt
→ livraison
→ clôture
→ rapport
```

## 25.4 Matrice cross-tenant

Avec A et B, tester systématiquement :

- ID direct ;
- liste ;
- recherche ;
- modification ;
- suppression ;
- export ;
- rapport ;
- cache ;
- queue ;
- fichier ;
- audit ;
- API key.

---

# 26. Quality Gate par feature

Une feature n'est pas terminée si :

- [ ] spec approuvée ;
- [ ] clarifications résolues ;
- [ ] plan validé ;
- [ ] tasks réalisées ;
- [ ] unit tests verts ;
- [ ] integration tests verts ;
- [ ] RBAC testé ;
- [ ] tenant isolation testée si applicable ;
- [ ] contrat API validé ;
- [ ] documentation mise à jour ;
- [ ] aucun secret dans les logs ;
- [ ] aucun TODO critique ;
- [ ] `speckit.converge` terminé.

---

# 27. Prompt anti-dérive

À utiliser si Claude Code commence à prendre des raccourcis :

```text
STOP.

Relis immédiatement :
- CLAUDE.md
- .specify/memory/constitution.md
- docs/cahier-des-charges.md
- la spec active
- le plan actif
- les tasks actives.

Contraintes non négociables :

1. Tenant isolation = frontière de sécurité.
2. SUPER_ADMIN ≠ ADMIN tenant.
3. Essai = 15 jours, calculé serveur.
4. Licence = autorité serveur.
5. Caisse = append-only.
6. Statut commande = jamais de régression.
7. Offline sync = idempotent.
8. UI hiding ≠ authorization.
9. Aucun job tenant-scoped sans tenant context.
10. Aucun export sans tenant scope.
11. Aucun secret dans les logs.
12. Ne modifie pas les exigences pour faire passer les tests.

Si une exigence est ambiguë, utilise /speckit.clarify.
Si une implémentation est en conflit avec la Constitution, corrige
l'implémentation, pas la règle.
```

---

# 28. Prompt de validation finale

```text
Ne déploie pas.

Effectue une recette complète de Fotall-Ma Pro.

1. Constitution
2. Architecture
3. Auth
4. RBAC
5. Tenant isolation
6. Licence 15 jours
7. Super-Admin
8. Onboarding
9. Clients
10. Services
11. Commandes
12. Caisse
13. Tickets
14. Notifications
15. Dashboard
16. Rapports
17. Web
18. Mobile
19. Offline sync
20. Billing
21. Audit
22. API
23. Backup/restore
24. Monitoring

Pour chaque point :
- PASS ;
- FAIL ;
- tests exécutés ;
- preuve ;
- risque restant.

Un FAIL critique bloque la release.
```

---

# 29. Ordre d'implémentation obligatoire

```text
001 Foundation
      ↓
002 Identity & Tenancy
      ↓
003 Tenant Isolation       ← RELEASE BLOCKER
      ↓
004 Licensing
      ↓
005 Super-Admin
      ↓
006 Onboarding
      ↓
007 Customers
      ↓
008 Services
      ↓
009 Orders
      ↓
010 Cash
      ↓
011 Tickets
      ↓
012 Notifications
      ↓
013 Dashboard
      ↓
014 Reports
      ↓
015 Web
      ↓
016 Mobile/Offline
      ↓
017 Billing
      ↓
018 Audit/Security
      ↓
019 Open API
      ↓
020 Production
```

---

# 30. Règles de communication de Claude Code

Avant de modifier le code, Claude Code doit annoncer :

- spec active ;
- objectif ;
- fichiers qui vont changer ;
- risques/ambiguïtés.

Après modification :

- changements effectués ;
- tests exécutés ;
- résultat ;
- risques restants ;
- tâches non terminées.

Claude Code ne doit jamais déclarer "terminé" lorsqu'un test obligatoire
est en échec.

---

**Fin des instructions Claude Code — Fotall-Ma Pro — Version 2.0**
