# Constitution — Fotall-Ma Pro

## I. Isolation multi-tenant

L'isolation entre tenants est une frontière de sécurité non négociable.

## II. Séparation des rôles

SUPER_ADMIN, ADMIN, CAISSIER, TECHNICIEN et LIVREUR ont des périmètres distincts.

## III. Licence

L'essai gratuit dure 15 jours et est calculé par le serveur. La licence est server-authoritative.

## IV. Finance

La caisse est append-only. Une correction est un événement compensatoire.

## V. Offline

Toute mutation offline est idempotente et porte son contexte tenant.

## VI. Qualité

Les tests unitaires, intégration, sécurité et E2E sont obligatoires selon le périmètre.

## VII. Traçabilité

Les actions sensibles sont auditées. Aucun secret ne doit apparaître dans les logs.

## VIII. Architecture

Tout changement architectural doit être documenté et approuvé.
