# Tickets & Printing — Fotall-Ma Pro

## Objectif

Définir et implémenter la fonctionnalité **Tickets & Printing** conformément au cahier des charges v2.0, à la Constitution et à l’architecture.

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

- Pas de nouvelle entité persistée : le ticket est une **projection en lecture** d'une `Commande`
  (009) existante — `GET /commandes/:id/ticket/pdf` et `GET /commandes/:id/ticket/escpos?largeur=58|80`.
- PDF (`pdfkit`) avec QR code embarqué (`qrcode`, référence `FOTALL-MA:COMMANDE:<numero>`).
- ESC/POS : encodeur écrit à la main (`escpos.builder.ts`), **sans dépendance à une imprimante
  réelle ni à une librairie tierce d'impression** — juste des séquences d'octets standard
  (`ESC @` init, `GS V 0` coupe papier), testables en isolant le buffer produit. 58mm ≈ 32
  colonnes, 80mm ≈ 48 colonnes (convention thermique standard).
- Numéro provisoire (offline) : `Commande.estProvisoire` (nouveau champ, `false` par défaut) est
  positionné par la future synchronisation offline (016) ; le ticket (PDF et ESC/POS) l'affiche
  clairement (`** PROVISOIRE **`) dès qu'il est vrai. Testé directement en manipulant le champ en
  base, faute de mécanisme offline encore existant pour le déclencher réellement.
- Lecture seule : mêmes rôles que la consultation des commandes (`ADMIN`, `CAISSIER`,
  `TECHNICIEN`, `LIVREUR`), jamais bloqué par `LicenceActiveGuard` (imprimer/réimprimer reste une
  lecture, §13.4).

## Périmètre différé / simplification documentée

- Le QR code n'est embarqué que dans le PDF. Pour l'ESC/POS, le numéro de commande est affiché en
  texte brut plutôt qu'en QR bitmap (commande `GS ( k` / rasterisation) : le support QR varie
  beaucoup selon les modèles d'imprimantes thermiques, et l'implémenter proprement pour toutes les
  variantes serait disproportionné pour cette spec. Le code-barres/QR papier physique reste
  consultable via le PDF ou en réimpression.
- Réouverture/rattachement d'une commande provisoire après synchronisation : spec 016.

## Critères d’acceptation

- [x] Fonctionnalité conforme à la spec.
- [x] Tests unitaires (`escpos.builder.spec.ts`, `pdf.builder.spec.ts`, `tickets.service.spec.ts`).
- [x] Tests intégration réels contre PostgreSQL (`tickets.integration.spec.ts`, job CI
      `integration`) : génération PDF (signature `%PDF-`), ESC/POS 58mm/80mm, marquage provisoire,
      isolation cross-tenant — sans dépendre d'une imprimante réelle.
- [x] Tests sécurité/RBAC (mêmes rôles que 009, JWT requis).
- [x] Tests tenant isolation (ticket d'une commande cross-tenant → 404).
- [x] Documentation mise à jour (cette spec).
