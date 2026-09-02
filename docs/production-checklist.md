# Checklist de mise en production

Document demandé par `CLAUDE.md` (§ Sécurité : "Avant production : HTTPS,
sessions sécurisées, chiffrement des données sensibles, audit, backups
quotidiens, restauration tenant par tenant, monitoring, alerting, quotas
API et tests de sécurité") et le cahier des charges §22 ("Lot 5 —
Production : sécurité, audit, API, sauvegardes, monitoring, recette").

Chaque ligne indique si l'élément est déjà couvert par du code testé dans
ce dépôt, ou s'il exige une décision/un provisionnement humain (pas de
cible de déploiement réelle dans cet environnement de développement —
voir spec 020-production).

## ✅ Couvert par du code testé

| Exigence                            | Implémentation                                                                                                                                                                                                                                                                                            | Preuve                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| HTTPS (en-têtes de sécurité)        | `helmet()` (HSTS, X-Content-Type-Options, X-Frame-Options, ...)                                                                                                                                                                                                                                           | `main.ts`                                                                                                       |
| HTTPS (redirection)                 | `creerMiddlewareHttps` — redirige tout trafic non chiffré en production, s'appuie sur `X-Forwarded-Proto` (terminaison TLS en amont, hors périmètre applicatif)                                                                                                                                           | `https-redirect.middleware.spec.ts`                                                                             |
| Sessions sécurisées                 | JWT signé serveur, jamais de secret client de confiance, ré-vérification de l'appartenance tenant à chaque requête (004/002)                                                                                                                                                                              | `jwt.strategy.spec.ts`                                                                                          |
| Audit                               | `AuditLog` tenant-scoped + journaux append-only dédiés (licence 004, financier 010/017, support 005, sauvegarde/restauration 020 — voir note ci-dessous)                                                                                                                                                  | 018-audit-security                                                                                              |
| Backups quotidiens                  | `BackupScheduler` (`@Cron`, chaque nuit à 2h) sauvegarde tous les tenants via `BackupService.sauvegarderTenant`, écrit sur disque (`BackupStorageService`), journalise dans `JournalSauvegarde`, purge au-delà de la rétention (30j par défaut) — un échec sur un tenant n'interrompt jamais les suivants | `backup.scheduler.spec.ts`, `backup-storage.service.spec.ts`                                                    |
| Restauration tenant par tenant      | `BackupService.restaurerTenant` (`DROP SCHEMA` + restauration depuis la sauvegarde), confirmation explicite exigée, audité dans `JournalSauvegarde`                                                                                                                                                       | `backup.integration.spec.ts` (round-trip complet : sauvegarde → corruption → restauration → données retrouvées) |
| Monitoring (sonde de disponibilité) | `GET /health` vérifie une vraie connexion base (pas seulement que le processus répond)                                                                                                                                                                                                                    | `health.integration.spec.ts`                                                                                    |
| Quotas API                          | `ApiKey.quotaJour`, glissant par jour (019) ; **et** quota global 100 req/min/IP sur toutes les routes internes web/mobile (`ThrottlerModule`)                                                                                                                                                            | `api-key.service.spec.ts`, suite d'intégration complète (aucune régression)                                     |
| Anti brute-force (connexion)        | `/auth/login` et `/auth/super-admin/login` limitées à 5 tentatives/minute/IP (`@Throttle`, fenêtre glissante, jamais un verrou permanent)                                                                                                                                                                 | `login-rate-limit.integration.spec.ts`                                                                          |
| CORS restreint en production        | `resoudreOriginsCors` — `CORS_ORIGINS` (liste blanche) obligatoire en production ; non configuré, tout est bloqué (échec visible, jamais un trou silencieux)                                                                                                                                              | `cors.config.spec.ts`                                                                                           |
| Tests de sécurité                   | Suite consolidée cross-tenant (accès direct par ID, LIST/recherche, UPDATE/DELETE, JWT falsifié, export, job planifié, RBAC)                                                                                                                                                                              | `security.integration.spec.ts` (018)                                                                            |
| Sessions sécurisées (expiration)    | JWT expire par défaut après 12h (`JWT_EXPIRES_IN`, configurable) — corrige une note obsolète de ce document qui le donnait comme non couvert                                                                                                                                                              | `common/jwt-config.module.ts`                                                                                   |

> **Note** : `JournalSauvegarde` vit au plan de contrôle, pas dans le schéma
> du tenant. Une restauration remplace intégralement ce schéma, y compris
> son `AuditLog` local — un journal qui y vivrait effacerait donc la preuve
> de sa propre restauration. Même raison que `SupportSession` (005).

## ⏸ Exige une décision ou un provisionnement humain

Ces éléments ne peuvent pas être "implémentés" de façon générique dans le
dépôt : ils dépendent d'un choix de fournisseur, d'une cible de
déploiement réelle, ou d'une politique commerciale/opérationnelle propre
à Fotall-Ma Pro.

- **Hébergement de production** : fournisseur, région, dimensionnement.
- **Certificat TLS et domaine** : le middleware HTTPS de ce dépôt suppose
  une terminaison TLS en amont (load balancer/reverse proxy/CDN) — quel
  composant la fournit doit être choisi.
- **Stockage des sauvegardes automatiques** : `BackupScheduler` écrit
  désormais chaque nuit sur disque local (`BACKUP_STORAGE_DIR`, défaut
  `<cwd>/backups/<tenantId>/<horodatage>.sql`), avec purge après
  `BACKUP_RETENTION_JOURS` (défaut 30) — même choix que
  `LogoStorageService` (aucun S3/MinIO dans la stack actuelle). Ce
  répertoire doit être placé sur un disque durable et **lui-même
  sauvegardé hors serveur** par l'hébergement retenu (un disque local qui
  meurt avec la machine n'est pas une vraie stratégie de sauvegarde) — un
  export périodique vers un stockage objet externe (S3 ou équivalent)
  reste recommandé avant une mise en production réelle, et le
  chiffrement au repos des fichiers de sauvegarde n'est pas non plus
  couvert applicativement.
- **Chiffrement des données sensibles au repos** : dépend du moteur de
  stockage retenu (chiffrement natif PostgreSQL managé, ou chiffrement
  applicatif de colonnes spécifiques) — aucune colonne n'est chiffrée
  applicativement dans ce projet à ce stade.
- **Monitoring applicatif (métriques, traces)** et **alerting** :
  `GET /health` est un point d'ancrage suffisant pour un système de
  supervision externe (Datadog, Prometheus, UptimeRobot, ...), mais aucun
  agent ni service tiers n'est intégré — à connecter au choix retenu.
- **Rotation de session JWT** (refresh token, révocation) — l'expiration
  fixe (12h) est couverte, mais aucun mécanisme de rafraîchissement/
  révocation anticipée n'existe. Reste périmètre différé.
- **`CORS_ORIGINS`** doit être positionnée avant la bascule en production
  (sinon toutes les requêtes cross-origin sont bloquées — voir
  `cors.config.ts`).
- **Recette** (§22, "Lot 5") : validation fonctionnelle finale par un
  humain avant bascule en production — ne peut pas être automatisée ici.

## Ce qui reste hors périmètre de tout le projet à ce stade

- Écrans mobiles (016 — seule la couche de données offline existe).
- Écrans web au-delà de connexion/dashboard/commandes (015).
- Webhooks sortants et ressources paiements/rapports de l'API ouverte
  (019).
- Multi-établissements Business (§14, capacité commerciale future non
  spécifiée).
