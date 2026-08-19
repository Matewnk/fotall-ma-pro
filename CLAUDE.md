# Fotall-Ma Pro — CLAUDE.md

## Source de vérité

Priorité stricte :

1. `.specify/memory/constitution.md`
2. `docs/cahier-des-charges.md`
3. `docs/instructions-claude-code-fotall-ma-pro.md`
4. `docs/architecture/`
5. `docs/testing/`
6. `specs/<spec-active>/`
7. ce fichier
8. `prompts/*.md`

Un niveau inférieur ne peut pas remplacer silencieusement un niveau supérieur.
En cas de contradiction : STOP, explique le conflit et attends une décision.

## Produit

SaaS multi-tenant de gestion de pressing : dashboard, clients, services,
commandes, tickets, notifications, caisse, rapports, administration,
licences/facturation et API ouverte. Web + mobile + tablette.

## Décision finale d'essai

**15 jours**, calculés côté serveur depuis la création du tenant.
Le `CLAUDE.md` fourni précédemment indique explicitement que cette décision
supersède la valeur historique de 7 jours présente dans les documents de mai 2026.
Tous les nouveaux prompts et tests utilisent donc 15 jours.

États : `ESSAI`, `ACTIVE`, `EXPIREE`, `SUSPENDUE`.
`EXPIREE` = essai terminé sans licence payante active.
`SUSPENDUE` = licence payante précédemment active bloquée/suspendue.

## Rôles — ne jamais fusionner

- `SUPER_ADMIN` : contrôle SaaS, tenants, plans, licences, abonnements,
  facturation globale, statistiques globales et support contrôlé.
- `ADMIN` : un seul tenant, configuration, utilisateurs, tarifs.
- `CAISSIER` : commandes, paiements, tickets, caisse.
- `TECHNICIEN` : statuts de traitement.
- `LIVREUR` : livraisons du jour et statut de livraison.

Le frontend n'est jamais une autorité de sécurité.

## Isolation multi-tenant — RELEASE BLOCKER

Aucune donnée d'un tenant ne doit être visible, exportable, modifiable,
supprimable ou devinable par un autre tenant.

Tout ce qui est tenant-scoped doit respecter le contexte tenant :
API, DB, fichiers, cache, queues/jobs/events, notifications, exports,
rapports, API keys, webhooks, audit, sauvegardes/restauration.

V1 : PostgreSQL 16, schéma dédié par tenant, provisionné automatiquement,
avec Prisma. `TenantContext` obligatoire. Un `tenant_id` fourni par le client
n'est jamais une preuve d'appartenance.

Tester au minimum : GET, LIST, SEARCH, UPDATE, DELETE, export, report, cache,
queue/job, fichier, API key, audit, tenant_id falsifié, JWT incorrect et accès
direct par ID d'un autre tenant.

## Stack verrouillée

- NestJS + TypeScript strict + Prisma
- PostgreSQL 16
- Redis
- pnpm + Turborepo
- React + Vite
- React Native + Expo
- SQLite + WatermelonDB (ou équivalent approuvé)
- REST + OpenAPI/Swagger
- JWT + OAuth2 selon le besoin
- FCM + WhatsApp Business + SMS
- ESC/POS + PDF
- Stripe ou Mobile Money local approuvé
- Docker + GitHub Actions

Un changement structurant exige une décision humaine et un ADR.

## Finance

La caisse est append-only. Les opérations sont des événements : ouverture,
encaissement, avance, dépense, remboursement, clôture. Aucune suppression ou
réécriture silencieuse. Le solde est dérivé des événements dans l'ordre
chronologique réel.

## Offline

Les opérations critiques doivent fonctionner hors ligne : commandes, caisse,
statuts, consultation des clients synchronisés.

Chaque mutation offline porte UUID local, `device_id`, timestamp local et,
si disponible, ID serveur.

Conflits :

- caisse : addition d'événements, jamais écrasement ;
- statut : état le plus avancé, jamais régression ;
- client : fusion champ par champ selon timestamp du champ ;
- commande offline : résolution ID temporaire → ID serveur.

Documenter dans `docs/sync-conflict-strategy.md`.

## Notifications

Architecture événementielle interne puis fournisseurs externes :
FCM, WhatsApp Business, SMS. Templates configurables par tenant. Dry-run en
développement. Événements : dépôt, prêt, livraison en route, livraison faite,
retard, paiement reçu, fin d'essai proche.

## Super-Admin / support

L'accès détaillé à un tenant passe par une session de support explicite :
tenant sélectionné, motif obligatoire, périmètre limité, audit début/fin.

## Sécurité

Jamais de secret dans Git ou les logs. Jamais de confiance dans le frontend.
Jamais de contournement de test pour rendre la CI verte.

Avant production : HTTPS, sessions sécurisées, chiffrement des données
sensibles, audit, backups quotidiens, restauration tenant par tenant,
monitoring, alerting, quotas API et tests de sécurité.

## Spec Kit

Une seule spec active.
Workflow :
READ → SPECIFY → CLARIFY → PLAN → CHECKLIST → TASKS → ANALYZE → IMPLEMENT →
TEST → REVIEW → CONVERGE → COMMIT → PR → MERGE.

Pour une fonctionnalité complexe, `/speckit.analyze` avant implémentation ;
`/speckit.converge` après.

## Git

`main` = production ; `develop` = intégration ; `feature/<spec-id>-<nom>` =
développement. Ne jamais coder directement sur `main`.

## Qualité

Une spec n'est terminée que si les checks applicables passent :
lint, typecheck, unit, integration, security, E2E et build.
Release blockers : isolation, RBAC, licence, finance, offline critique,
build/typecheck/tests.

## Contrat de réponse Claude Code

Avant modification : spec active, fichiers attendus, ambiguïtés, impact sécurité.
Après modification : résumé, tests et résultats, risques, décisions restantes.
Ne jamais déclarer une réussite avec un test échoué. Finir par `git status`.
