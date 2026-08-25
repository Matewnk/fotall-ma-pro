# Production — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Production** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

## Références

- `docs/cahier-des-charges.md` (§15.8 sauvegarde, §20 observabilité, §22 lot 5)
- `.specify/memory/constitution.md`
- `docs/architecture/architecture.md`
- `docs/testing/test-strategy.md`
- `docs/production-checklist.md` (détail complet, couvert vs. différé)

## Exigences

- Les autorisations sont vérifiées côté serveur.
- Toute donnée tenant-scoped est strictement isolée.
- Les jobs et exports conservent le contexte tenant.
- Les opérations critiques sont idempotentes.

## Mécanisme implémenté

**Décision de périmètre** (dernière spec de la roadmap, nature différente
des précédentes) : cet environnement de développement n'a aucune cible de
déploiement réelle (pas de compte cloud, pas de domaine, pas de stack de
monitoring existante). Choisir un fournisseur d'hébergement, de stockage
de sauvegardes ou d'alerting reviendrait à décider à la place de
l'utilisateur — la tranche retenue est donc "préparation au niveau code" :
tout ce qui est exprimable et testable sans dépendance à un fournisseur,
documenté dans `docs/production-checklist.md` pour ce qui reste un choix
humain.

- **Sauvegarde/restauration tenant par tenant** (§15.8) :
  `BackupService` (`pg_dump`/`psql` réels, schéma unique par tenant,
  ADR-001) — `POST /super-admin/tenants/:id/backup` (dump téléchargeable)
  et `POST /super-admin/tenants/:id/restore` (confirmation explicite
  exigée, destructif par nature — `DROP SCHEMA` puis recréation). Chaque
  opération est auditée (018). Round-trip complet prouvé contre
  PostgreSQL réel (sauvegarde → corruption délibérée → restauration →
  données retrouvées).
- **Sonde de disponibilité** (§20 "monitoring") : `GET /health` vérifie
  une vraie connexion à la base control-plane (`SELECT 1`), pas
  seulement que le processus Node répond — point d'ancrage suffisant
  pour un load balancer ou un système de supervision externe.
- **En-têtes de sécurité HTTPS** (§19.1) : `helmet()` (HSTS,
  X-Content-Type-Options, X-Frame-Options, ...).
- **Redirection HTTPS** : `creerMiddlewareHttps`, actif uniquement en
  production (jamais en développement local), basé sur
  `X-Forwarded-Proto` — la terminaison TLS elle-même reste la
  responsabilité d'un load balancer/reverse proxy en amont.

## Périmètre différé

Voir `docs/production-checklist.md` pour le détail complet. En résumé :
hébergement, domaine/certificat TLS, stockage et planification
automatique des sauvegardes, chiffrement au repos, intégration d'un
service de monitoring/alerting tiers, rotation de session JWT,
protection anti brute-force, recette finale — tous nécessitent une
décision ou un provisionnement humain qu'aucun code ne peut remplacer.

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec (pour le périmètre "préparation
      code" retenu).
- [x] Tests unitaires (`backup.service.spec.ts`, `database-url.spec.ts`,
      `https-redirect.middleware.spec.ts`, `app.controller.spec.ts`
      mis à jour).
- [x] Tests intégration (`backup.integration.spec.ts` : round-trip
      complet, RBAC, isolation ; `health.integration.spec.ts`).
- [x] Tests sécurité/RBAC (sauvegarde/restauration SUPER_ADMIN
      uniquement).
- [x] Tests tenant isolation (la sauvegarde d'un tenant ne contient
      jamais un autre tenant).
- [x] Documentation mise à jour (`docs/production-checklist.md` créé).
