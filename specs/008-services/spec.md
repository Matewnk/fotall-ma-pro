# Services & Tarifs — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Services & Tarifs** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

## Références

- `docs/cahier-des-charges.md`
- `.specify/memory/constitution.md`
- `docs/architecture/architecture.md`
- `docs/testing/test-strategy.md`

## Exigences

- Les autorisations sont vérifiées côté serveur.
- Toute donnée tenant-scoped est strictement isolée.
- Les jobs et exports conservent le contexte tenant.
- Les opérations critiques sont idempotentes.

## Mécanisme implémenté

- `Service` (schéma tenant-scoped) : code (unique), intitulé, catégorie, délai (heures), tarif
  (`Decimal(10,2)`), actif, timestamps.
- CRUD + liste filtrable par `actif`. Lecture ouverte à `ADMIN`+`CAISSIER` ; écriture réservée à
  `ADMIN` seul (cahier des charges §2.1 : « gérer les tarifs et services » est une prérogative
  ADMIN).
- `@RequireActiveLicence()` sur create/update/delete (même mécanisme que 007).
- Validation tarif : rejeté si négatif (`@Min(0)`).
- **Boucle avec l'onboarding (006) refermée** : `OnboardingService.completerEtape2` sème
  désormais réellement le catalogue standard (10 codes de référence, tarifs indicatifs) quand le
  tenant choisit `CATALOGUE_STANDARD` ; rien n'est créé pour `GRILLE_VIERGE`. Le choix était
  stocké depuis 006 mais n'avait aucun effet concret faute d'entité Service — c'est fait
  maintenant. Le seeding est idempotent (`skipDuplicates`), cohérent avec la reprenabilité de
  l'onboarding.
- Le tarif d'un tenant n'apparaît jamais dans un autre tenant (exigence explicite du cahier des
  charges) : garanti structurellement par `TenantPrismaFactory` (schéma PostgreSQL dédié), comme
  pour `Client`.

## Périmètre différé

- Aucun lien avec les commandes pour l'instant (entité `Commande`, spec 009) : le catalogue existe
  en autonomie, prêt à être référencé dès que les commandes existeront.

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec.
- [x] Tests unitaires (`services.service.spec.ts`).
- [x] Tests intégration réels contre PostgreSQL (`services.integration.spec.ts`, job CI
      `integration`) : validation tarif, CRUD, isolation du tarif cross-tenant, permissions
      (CAISSIER lecture seule), bouclage onboarding (CATALOGUE_STANDARD → 10 services,
      GRILLE_VIERGE → 0).
- [x] Tests sécurité/RBAC (CAISSIER → 403 en écriture).
- [x] Tests tenant isolation (le tarif ne fuite jamais cross-tenant, testé explicitement).
- [x] Documentation mise à jour (cette spec).
