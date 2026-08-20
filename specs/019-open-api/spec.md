# Open API — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Open API** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

## Références

- `docs/cahier-des-charges.md` (§17 — API ouverte)
- `.specify/memory/constitution.md`
- `docs/architecture/architecture.md`
- `docs/testing/test-strategy.md`

## Exigences

- Les autorisations sont vérifiées côté serveur.
- Toute donnée tenant-scoped est strictement isolée.
- Les jobs et exports conservent le contexte tenant.
- Les opérations critiques sont idempotentes.

## Mécanisme implémenté

**Documentation OpenAPI** (`GET /docs`) : générée via le plugin CLI
`@nestjs/swagger` (`nest-cli.json`), qui infère le schéma à partir des
DTO existants (décorateurs `class-validator` déjà en place depuis 001) —
aucune annotation manuelle `@ApiProperty` requise sur la quarantaine de
DTO déjà écrits.

**Clés API** (`ApiKey`, control-plane, §17 point par point) :

- appartient à un seul tenant (`tenantId`) ;
- possède des scopes (`clients:read`, `commandes:read` dans cette
  tranche) ;
- peut être révoquée (`revoqueeAt`, irréversible) ;
- soumise à un quota (`quotaJour`, glissant par jour, remis à zéro
  automatiquement au changement de jour — pas de table d'usage séparée).

Stockée hachée (SHA-256 — hash rapide adapté à un secret haute entropie
généré machine, contrairement à bcrypt pour les mots de passe
utilisateur) : la clé en clair n'est retournée qu'une seule fois, à la
création (`POST /api-keys`), jamais retrouvable ensuite.

**Gestion** (`ApiKeysController`, `/api-keys`, JWT + ADMIN uniquement,
§2.1) : création, liste (masquée), révocation.

**Surface exposée** (`PublicApiController`, `/api/v1/*`,
authentification par `ApiKeyGuard` + en-tête `X-Api-Key` — jamais de
JWT sur cette surface) : réutilise directement `ClientsService` (007) et
`OrdersService` (009), même isolation tenant que le reste de
l'application (`TenantPrismaFactory`).

## Périmètre différé

- §17 liste 4 ressources (clients, commandes, **paiements, rapports**) :
  seules clients et commandes sont exposées dans cette tranche. Paiements
  et rapports suivraient exactement le même schéma
  (`@RequireScopes('paiements:read')` + réutilisation de `CashService`/
  `ReportsService`) — non ajoutés ici pour garder cette PR revue-able,
  cohérent avec la même discipline de tranche que 015/016.
- **Webhooks sortants** (§17 : "commande créée", "statut modifié",
  "paiement reçu") : non implémentés. L'architecture cible réutiliserait
  exactement le pattern déjà établi en 012 (`NotificationsEventsListener`
  écoutant les mêmes évènements `commande.creee`/`commande.en_cours`/
  `commande.prete`/`commande.livree` déjà émis par `OrdersService`), avec
  un nouveau modèle `WebhookAbonnement` (url, évènements, secret HMAC) et
  un journal `WebhookLivraison` append-only pour la traçabilité des
  livraisons (réussite/échec). `BillingService` n'émet actuellement aucun
  évènement `EventEmitter2` pour "paiement reçu" — à ajouter au même
  moment.
- **Quotas par plan commercial** (§17 : "soumise aux quotas du plan") :
  le quota est configurable par clé (`quotaJour`, ADMIN le choisit à la
  création) plutôt que dérivé automatiquement du plan `PlanCommercial`
  du tenant — aucun nombre de référence par plan n'est fixé dans le
  cahier des charges (même situation que les montants de facturation,
  017).

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec (pour le périmètre livré).
- [x] Tests unitaires (`api-key.service.spec.ts` : 10 tests ;
      `api-key.guard.spec.ts` : 5 tests).
- [x] Tests intégration (`open-api.integration.spec.ts`, PostgreSQL
      réel : cycle de vie complet, scopes, quota journalier, absence de
      clé, isolation cross-tenant, RBAC, fumée sur `/docs`).
- [x] Tests sécurité/RBAC (ADMIN uniquement sur `/api-keys` ; clé
      absente/inconnue/révoquée/hors-scope toutes refusées sur
      `/api/v1/*`).
- [x] Tests tenant isolation.
- [x] Documentation mise à jour.
