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

| Exigence                            | Implémentation                                                                                                                                                  | Preuve                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| HTTPS (en-têtes de sécurité)        | `helmet()` (HSTS, X-Content-Type-Options, X-Frame-Options, ...)                                                                                                 | `main.ts`                                                                                                       |
| HTTPS (redirection)                 | `creerMiddlewareHttps` — redirige tout trafic non chiffré en production, s'appuie sur `X-Forwarded-Proto` (terminaison TLS en amont, hors périmètre applicatif) | `https-redirect.middleware.spec.ts`                                                                             |
| Sessions sécurisées                 | JWT signé serveur, jamais de secret client de confiance, ré-vérification de l'appartenance tenant à chaque requête (004/002)                                    | `jwt.strategy.spec.ts`                                                                                          |
| Audit                               | `AuditLog` tenant-scoped + journaux append-only dédiés (licence 004, financier 010/017, support 005)                                                            | 018-audit-security                                                                                              |
| Backups quotidiens (mécanisme)      | `BackupService.sauvegarderTenant` (`pg_dump --schema=<tenant>`)                                                                                                 | `backup.service.spec.ts`, `backup.integration.spec.ts`                                                          |
| Restauration tenant par tenant      | `BackupService.restaurerTenant` (`DROP SCHEMA` + restauration depuis la sauvegarde), confirmation explicite exigée, audité                                      | `backup.integration.spec.ts` (round-trip complet : sauvegarde → corruption → restauration → données retrouvées) |
| Monitoring (sonde de disponibilité) | `GET /health` vérifie une vraie connexion base (pas seulement que le processus répond)                                                                          | `health.integration.spec.ts`                                                                                    |
| Quotas API                          | `ApiKey.quotaJour`, glissant par jour (019)                                                                                                                     | `api-key.service.spec.ts`                                                                                       |
| Tests de sécurité                   | Suite consolidée cross-tenant (accès direct par ID, LIST/recherche, UPDATE/DELETE, JWT falsifié, export, job planifié, RBAC)                                    | `security.integration.spec.ts` (018)                                                                            |

## ⏸ Exige une décision ou un provisionnement humain

Ces éléments ne peuvent pas être "implémentés" de façon générique dans le
dépôt : ils dépendent d'un choix de fournisseur, d'une cible de
déploiement réelle, ou d'une politique commerciale/opérationnelle propre
à Fotall-Ma Pro.

- **Hébergement de production** : fournisseur, région, dimensionnement.
- **Certificat TLS et domaine** : le middleware HTTPS de ce dépôt suppose
  une terminaison TLS en amont (load balancer/reverse proxy/CDN) — quel
  composant la fournit doit être choisi.
- **Stockage des sauvegardes** : `BackupService` produit un dump SQL en
  mémoire (`Buffer`) ; où et combien de temps le conserver (S3 ou
  équivalent, rétention, chiffrement au repos) reste à définir. La
  planification quotidienne automatique (cron/job) n'est pas câblée —
  seul le mécanisme à la demande (`POST /super-admin/tenants/:id/backup`)
  existe.
- **Chiffrement des données sensibles au repos** : dépend du moteur de
  stockage retenu (chiffrement natif PostgreSQL managé, ou chiffrement
  applicatif de colonnes spécifiques) — aucune colonne n'est chiffrée
  applicativement dans ce projet à ce stade.
- **Monitoring applicatif (métriques, traces)** et **alerting** :
  `GET /health` est un point d'ancrage suffisant pour un système de
  supervision externe (Datadog, Prometheus, UptimeRobot, ...), mais aucun
  agent ni service tiers n'est intégré — à connecter au choix retenu.
- **Rotation/expiration de session JWT, protection anti brute-force**
  (§19.1) — notés comme périmètre différé depuis 018-audit-security.
- **Recette** (§22, "Lot 5") : validation fonctionnelle finale par un
  humain avant bascule en production — ne peut pas être automatisée ici.

## Ce qui reste hors périmètre de tout le projet à ce stade

- Écrans mobiles (016 — seule la couche de données offline existe).
- Écrans web au-delà de connexion/dashboard/commandes (015).
- Webhooks sortants et ressources paiements/rapports de l'API ouverte
  (019).
- Multi-établissements Business (§14, capacité commerciale future non
  spécifiée).
