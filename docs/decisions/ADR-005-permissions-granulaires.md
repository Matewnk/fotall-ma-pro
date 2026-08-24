# ADR-005 — Permissions granulaires par utilisateur

Les 5 rôles (`SUPER_ADMIN`, `ADMIN`, `CAISSIER`, `TECHNICIEN`, `LIVREUR`) sont
conservés tels quels, jamais fusionnés. Au-dessus du rôle, un ADMIN peut
accorder (`ALLOW`) ou retirer (`DENY`) explicitement une permission nommée
pour un utilisateur de son propre tenant, en plus des permissions par défaut
du rôle (matrice ✅/❌/⚙).

Modèle d'autorisation retenu : RBAC + overrides `ALLOW`/`DENY` explicites
(Option C). Priorité de résolution : `DENY` explicite > `ALLOW` explicite >
valeur par défaut du rôle. Un `DENY` peut donc retirer un droit normalement
inclus par défaut dans le rôle (ex. un CAISSIER sans `commandes.encaisser`).

`users.manage` et `users.permissions` restent non-configurables (toujours
`ADMIN` uniquement, jamais accordables ni révocables par override), pour
empêcher toute élévation de privilège déguisée en changement de permission.

Le catalogue de permissions est une liste fermée côté serveur ; aucun
`permission = "*"` ni bypass `admin = true` n'est autorisé.

Chaque changement de permission est journalisé dans l'`AuditLog` tenant-scopé
existant (`entityType = 'UserPermission'`), jamais un écrasement silencieux.

Détail complet : `specs/021-permissions-granulaires/spec.md`.
