# CAHIER DES CHARGES — FOTALL-MA PRO

**Application de gestion de pressing multi-plateforme — SaaS multi-tenant**  
**Version : 2.0**  
**Date de mise à jour : 17 août 2026**  
**Statut : Document de référence pour le développement**  
**Plateformes : Web, mobile iOS/Android, tablette**  
**Langue de référence : Français**  
**Confidentiel — Fotall-Ma Pro**

---

## Historique et décisions de mise à jour

Cette version consolide le cahier des charges initial et les décisions de cadrage
prises pour le développement avec Spec Kit + Claude Code.

### Corrections majeures

1. **Essai gratuit : 15 jours.**  
   Le document initial indiquait 7 jours. La durée officielle retenue pour la
   présente version est **15 jours**, calculés côté serveur à partir de la
   création du tenant. Les dates ne sont jamais calculées à partir de
   l'installation ou de l'horloge du téléphone.

2. **SaaS Control Plane et tenant clairement séparés.**  
   Le **Super-Administrateur (SaaS)** est distinct de l'**Administrateur
   (tenant)**. Le premier gère la plateforme, les tenants, licences,
   abonnements et facturation globale. Le second gère un seul pressing.

3. **Isolation multi-tenant : exigence de sécurité non négociable.**  
   Aucune donnée d'un tenant ne doit être visible, modifiable, exportable ou
   devinable par un autre tenant. La règle s'applique à l'API, à la base, au
   cache, aux files d'attente, aux fichiers, aux exports, aux jobs, aux audits
   et aux journaux applicatifs.

4. **V1 : schéma PostgreSQL dédié par tenant.**  
   Le schéma dédié est le mécanisme physique d'isolation retenu au démarrage.
   Le contexte `tenant_id` reste obligatoire dans l'application, les jobs, les
   événements, les caches, les fichiers, les exports et les audits. Une
   migration future vers tables partagées + RLS PostgreSQL ne pourra être faite
   qu'avec maintien ou renforcement des garanties.

5. **Licence pilotée côté serveur.**  
   Le client Web/Mobile/Tablette ne décide jamais de l'état ou de la date
   d'expiration d'une licence.

6. **Facturation et licence gérées par le Super-Administrateur.**  
   Le parcours de référence V1 est piloté par le back-office SaaS. Les
   intégrations de paiement peuvent automatiser les événements de facturation,
   mais elles ne donnent pas au tenant un droit implicite de modifier
   directement la licence.

7. **Offline-first pour les opérations critiques.**  
   Les commandes, opérations de caisse, statuts de traitement et certaines
   consultations doivent rester utilisables hors connexion selon les règles
   de synchronisation définies dans ce document.

8. **Les opérations financières sont append-only.**  
   Une opération de caisse n'est pas écrasée. Une correction est une nouvelle
   opération compensatoire, avec traçabilité.

---

# 1. Présentation générale

## 1.1 Contexte

Fotall-Ma Pro est une application SaaS destinée aux établissements de
pressing. Elle couvre le cycle de vie d'une commande : dépôt des vêtements,
création de commande, traitement, préparation, notification, retrait ou
livraison, paiement et suivi de caisse.

L'application est multi-tenant : plusieurs pressings utilisent la même
plateforme, mais chacun dispose d'un périmètre de données strictement isolé.

## 1.2 Objectifs

- Centraliser les opérations du pressing.
- Réduire les erreurs de saisie et de suivi.
- Améliorer l'expérience client par les notifications.
- Faciliter l'encaissement et la clôture quotidienne.
- Donner des indicateurs opérationnels et financiers.
- Fonctionner sur Web, mobile et tablette.
- Permettre un fonctionnement critique hors connexion.
- Fournir un modèle SaaS avec essai gratuit de 15 jours puis abonnement.
- Permettre au Super-Administrateur de piloter les tenants et licences.
- Garantir une isolation multi-tenant stricte.

## 1.3 Périmètre

| Domaine               | Fonction                                                  |
| --------------------- | --------------------------------------------------------- |
| Tableau de bord       | KPIs, alertes, commandes récentes                         |
| Clients               | fiches, recherche, historique                             |
| Services              | catalogue, tarifs, délais                                 |
| Commandes             | dépôt, articles, statut, livraison/retrait                |
| Tickets               | ticket numérique, PDF, QR/barcode, ESC/POS                |
| Notifications         | Push, WhatsApp, SMS selon configuration                   |
| Caisse                | ouverture, encaissement, dépenses, remboursement, clôture |
| Rapports              | activité, caisse, recettes, clients, services             |
| Administration tenant | utilisateurs, configuration, tarifs                       |
| SaaS                  | tenants, licences, plans, abonnements, facturation        |
| Sécurité              | RBAC, isolation, audit, sauvegardes                       |
| Offline               | opérations critiques et synchronisation                   |

---

# 2. Rôles et autorisations

## 2.1 Rôles applicatifs officiels

### Super-Administrateur (SaaS)

Périmètre : plateforme entière.

Peut :

- créer et gérer les tenants ;
- consulter les statistiques globales ;
- gérer les plans ;
- activer, suspendre, réactiver ou révoquer une licence ;
- gérer la facturation SaaS ;
- superviser l'usage et les incidents ;
- traiter les demandes de support.

L'accès aux données détaillées d'un tenant doit passer par un **mode support
explicite**, avec motif obligatoire et audit.

### Administrateur (tenant)

Périmètre : **un seul pressing**.

Peut :

- configurer le pressing ;
- gérer les utilisateurs de son tenant ;
- gérer les tarifs et services ;
- consulter les commandes et clients de son tenant ;
- consulter les rapports de son tenant ;
- gérer la configuration des notifications ;
- superviser la caisse selon les permissions définies.

Ne peut jamais accéder au back-office SaaS ni aux autres tenants.

### Caissier

- créer et modifier les commandes selon le workflow ;
- gérer les paiements ;
- imprimer les tickets ;
- effectuer les opérations de caisse autorisées ;
- consulter les clients nécessaires à son travail.

### Technicien

- consulter les commandes nécessaires au traitement ;
- modifier les statuts de traitement autorisés ;
- ne gère pas la configuration du pressing ;
- ne gère pas les licences ;
- ne gère pas la caisse.

### Livreur

- consulter les livraisons du jour qui lui sont attribuées ou accessibles
  dans son tenant ;
- mettre à jour le statut de livraison ;
- confirmer la remise ou l'échec de livraison ;
- ne gère pas les tarifs, utilisateurs ou licences.

## 2.2 Règle RBAC

Le masquage d'un bouton dans l'interface ne constitue jamais une autorisation.
Toutes les permissions sont contrôlées côté serveur.

---

# 3. Architecture multi-plateforme

## 3.1 Plateformes

| Plateforme | Cible                                 |
| ---------- | ------------------------------------- |
| Mobile     | iOS 16+, Android 10+                  |
| Tablette   | iPadOS et Android Tablet              |
| Web        | Chrome, Firefox, Edge, Safari récents |

## 3.2 Expérience

- Mobile : tactile, caméra, push, fonctionnement offline.
- Tablette : interface tactile, paysage prioritaire.
- Web : interface complète, clavier, impression directe.

## 3.3 Stack retenue

- Monorepo : pnpm + Turborepo.
- Backend : NestJS + TypeScript.
- ORM : Prisma.
- Base : PostgreSQL 16.
- Cache/queues : Redis.
- Web : React + Vite + TypeScript.
- Mobile/tablette : React Native + Expo + TypeScript.
- Offline : SQLite avec WatermelonDB ou abstraction équivalente.
- API : REST + OpenAPI.
- Authentification : JWT ; frontière OAuth2-compatible si nécessaire.
- Push : Firebase Cloud Messaging.
- WhatsApp : WhatsApp Business API.
- SMS : fournisseur local ou international compatible.
- Impression : ESC/POS + PDF.
- Facturation : Stripe ou passerelle Mobile Money approuvée.
- CI/CD : GitHub Actions.
- Conteneurisation : Docker.

Toute dépendance nouvelle doit être justifiée.

---

# 4. Tableau de bord

## 4.1 KPIs

- Nombre de commandes du jour.
- Chiffre d'affaires du jour.
- Articles en attente.
- Livraisons prévues aujourd'hui.
- Commandes en retard.
- Revenus des 7 derniers jours.

Les calculs sont toujours limités au tenant courant.

## 4.2 Commandes récentes

Afficher les 10 dernières commandes du tenant avec :

- numéro ;
- client ;
- date ;
- montant ;
- statut.

Statuts :

`EN_ATTENTE → EN_COURS → PRET → LIVRE`

Le statut ne doit jamais régresser.

## 4.3 Alertes

- commandes urgentes ;
- retards ;
- paiements en attente ;
- livraisons du jour ;
- erreurs de synchronisation ;
- licence proche de l'expiration.

---

# 5. Gestion des clients

## 5.1 Fiche client

Champs :

- nom ;
- téléphone obligatoire ;
- email facultatif ;
- adresse ;
- canal de notification préféré ;
- statut ;
- notes éventuelles ;
- dates de création/modification.

## 5.2 Fonctionnalités

- création ;
- modification ;
- consultation ;
- recherche par nom/téléphone ;
- historique des commandes ;
- historique des notifications ;
- export tenant-scoped si autorisé.

## 5.3 Isolation

Un client appartient à un seul tenant. Toute requête de client doit être
scopée par le contexte tenant.

---

# 6. Services, tarifs et commandes

## 6.1 Catalogue

Chaque tenant possède son propre catalogue.

Champs indicatifs :

- code ;
- intitulé ;
- catégorie ;
- délai standard ;
- tarif ;
- actif/inactif.

Codes de référence initiaux possibles :

- `SRV-01` Lavage simple ;
- `SRV-02` Lavage + séchage ;
- `SRV-03` Repassage ;
- `SRV-04` Nettoyage à sec ;
- `SRV-05` Costume complet ;
- `SRV-06` Chemise ;
- `SRV-07` Pantalon ;
- `SRV-08` Robe ;
- `LIV-01` Livraison standard ;
- `LIV-02` Livraison express.

Les tarifs proposés à l'onboarding sont des valeurs indicatives et doivent
être modifiables.

## 6.2 Création d'une commande

Informations minimales :

- client ;
- articles ;
- service ;
- quantité ;
- tarif unitaire ;
- sous-total ;
- remise éventuelle ;
- total ;
- date prévue ;
- mode retrait/livraison ;
- adresse de livraison si applicable ;
- notes ;
- statut.

## 6.3 Statuts

```text
EN_ATTENTE
    ↓
EN_COURS
    ↓
PRET
    ↓
LIVRE
```

Une transition vers un état antérieur est interdite.

## 6.4 Livraison

Prévoir :

- adresse ;
- zone ;
- créneau ;
- livreur ;
- statut ;
- preuve de remise selon la politique produit.

---

# 7. Tickets, QR et impression

Chaque commande validée reçoit un identifiant unique.

Le ticket contient notamment :

- identité du pressing ;
- numéro de commande ;
- client ;
- articles ;
- services ;
- quantités ;
- prix ;
- total ;
- date prévue ;
- mode de paiement ;
- QR Code ou code-barres ;
- informations de livraison/retrait.

Formats :

- PDF ;
- imprimante thermique 58 mm ;
- imprimante thermique 80 mm.

En offline, un numéro provisoire doit être explicitement marqué comme tel
jusqu'à synchronisation.

---

# 8. Notifications

## 8.1 Canaux

- Push ;
- WhatsApp ;
- SMS.

## 8.2 Événements

- commande créée ;
- commande en cours ;
- commande prête ;
- livraison prévue ;
- commande livrée ;
- rappel ;
- licence proche expiration.

## 8.3 Architecture

Les modules métier émettent des événements internes. Le module de notification
consomme ces événements et appelle les fournisseurs externes.

Il ne faut pas coupler directement le domaine pressing à Twilio, WhatsApp ou FCM.

## 8.4 Licence et offline

La vérification de licence est serveur-authoritative.

Une application cliente peut conserver la dernière vérification valide pendant
une courte fenêtre offline proposée à **24 heures maximum**, sans jamais
modifier la date d'expiration serveur. Au-delà, les écritures peuvent être
bloquées selon l'état de licence.

---

# 9. Caisse et paiements

## 9.1 Opérations

- ouverture ;
- encaissement ;
- avance ;
- dépense ;
- remboursement ;
- ajustement compensatoire ;
- clôture.

## 9.2 Modes de paiement

- espèces ;
- carte ;
- Mobile Money ;
- autre mode configuré par le tenant.

## 9.3 Journal

Chaque opération contient au minimum :

- identifiant ;
- tenant ;
- date/heure ;
- opérateur ;
- type ;
- référence ;
- montant ;
- mode de paiement ;
- solde avant ;
- solde après ou informations permettant son recalcul ;
- commande/client si applicable ;
- identifiant d'idempotence.

## 9.4 Règle append-only

Une opération financière ne doit jamais être écrasée ou supprimée pour
corriger une erreur. Une correction crée un nouvel événement compensatoire.

## 9.5 Offline

Deux appareils peuvent créer des opérations hors connexion. La synchronisation
doit être idempotente et le résultat final indépendant de l'ordre d'arrivée des
événements.

Une opération offline arrivée après la clôture de sa journée doit être
rattachée à la journée correspondant à son horodatage métier et déclencher une
alerte si une réouverture est nécessaire.

---

# 10. Rapports et statistiques

## 10.1 Rapports

- caisse quotidienne ;
- activité quotidienne/hebdomadaire/mensuelle ;
- recettes par service ;
- top clients ;
- services les plus utilisés ;
- livraisons/retraits ;
- commandes en retard ;
- paiements.

## 10.2 Exports

- CSV ;
- Excel ;
- PDF.

Tous les exports sont tenant-scoped.

Les exports volumineux sont exécutés en tâche asynchrone avec tenant context.

---

# 11. Paramètres et administration du tenant

## 11.1 Utilisateurs

L'Administrateur du tenant peut gérer :

- ADMIN selon politique ;
- CAISSIER ;
- TECHNICIEN ;
- LIVREUR.

Les comptes sont toujours rattachés à un tenant.

## 11.2 Configuration

- nom commercial ;
- logo ;
- couleurs ;
- téléphone ;
- adresse ;
- devise ;
- langue ;
- fuseau horaire ;
- catalogue ;
- tarifs ;
- zones de livraison ;
- modèles de notifications.

---

# 12. Onboarding

À la première connexion de l'Administrateur :

### Étape 1 — Identité

- nom ;
- logo ;
- adresse ;
- téléphone ;
- devise ;
- langue.

### Étape 2 — Tarifs

- catalogue standard pré-rempli ou grille vierge ;
- modification immédiate.

### Étape 3 — Premier utilisateur et notifications

- confirmation de l'Administrateur ;
- canal préféré ;
- test de notification.

L'onboarding est reprenable. Il ne bloque jamais l'utilisation normale.

---

# 13. SaaS, tenants et licences

## 13.1 Tenant

Un tenant représente un pressing client de la plateforme.

Le tenant possède :

- utilisateurs ;
- clients ;
- services ;
- tarifs ;
- commandes ;
- caisse ;
- notifications ;
- fichiers ;
- rapports ;
- configuration.

## 13.2 Essai gratuit

**Durée officielle : 15 jours.**

Le jour de départ est la date/heure serveur de création du tenant.

La date de fin est calculée une seule fois :

`date_fin_essai = date_debut_essai + 15 jours`

Le client ne peut pas fournir ou modifier cette date.

## 13.3 États de licence

```text
ESSAI
 ├── paiement/activation → ACTIVE
 └── fin des 15 jours → EXPIREE

ACTIVE
 ├── paiement en échec / décision Super-Admin → SUSPENDUE
 └── expiration de période payée non renouvelée → SUSPENDUE ou EXPIREE
    selon la politique de facturation

SUSPENDUE
 └── régularisation + réactivation → ACTIVE
```

Les états `EXPIREE` et `SUSPENDUE` sont distincts :

- `EXPIREE` : essai terminé sans activation payante ou révocation définitive ;
- `SUSPENDUE` : licence payante temporairement bloquée.

La transition exacte entre expiration de période payée et suspension doit rester
alignée avec le module de facturation.

## 13.4 Lecture seule

En état bloqué, les lectures nécessaires peuvent rester disponibles, mais les
écritures métier bloquantes sont interdites selon une liste centralisée
`LicenceActiveGuard`.

Cette liste doit être explicite et testée.

## 13.5 Licence technique

La licence peut être représentée par un JWT signé côté serveur contenant :

- `tenant_id` ;
- plan ;
- statut ;
- expiration ;
- identifiant de licence.

La clé de signature n'est jamais stockée côté client comme secret de confiance.

## 13.6 Super-Administrateur

Le Super-Administrateur gère :

- tenants ;
- licences ;
- plans ;
- abonnements ;
- facturation ;
- support ;
- statistiques globales.

Toute action manuelle sensible est auditée.

---

# 14. Plans commerciaux

Plans de référence :

### Starter

- un point de vente ;
- fonctionnalités essentielles ;
- volume limité selon la politique commerciale.

### Pro

- plusieurs utilisateurs ;
- commandes selon la politique du plan ;
- notifications avancées.

### Business

- multi-établissements si la fonctionnalité multi-établissements est activée ;
- API ouverte ;
- support prioritaire.

**Important :** la gestion multi-établissements Business est une capacité
commerciale future à spécifier séparément. Elle ne crée pas un nouveau rôle
applicatif tant qu'une spécification dédiée n'est pas approuvée.

## 14.1 Facturation

- abonnement mensuel ;
- carte bancaire ;
- Mobile Money ;
- virement si géré par le back-office ;
- relances automatiques ;
- événements de paiement idempotents.

En V1, le tenant ne modifie pas directement l'état de sa licence. Le
Super-Administrateur conserve la maîtrise du cycle de licence ; les webhooks
de paiement peuvent déclencher des workflows préparés et audités.

---

# 15. Architecture multi-tenant — exigence absolue

## 15.1 Principe

Aucune donnée d'un tenant A ne doit être :

- lue par B ;
- modifiée par B ;
- supprimée par B ;
- exportée par B ;
- révélée par recherche ;
- révélée par erreur de statut ;
- révélée par une URL ;
- révélée par un cache ;
- révélée par un job ;
- révélée par un fichier ;
- révélée par un rapport ;
- révélée par un log applicatif ;
- devinable par énumération d'identifiants.

## 15.2 Stratégie V1

PostgreSQL :

- une base de contrôle globale ;
- un schéma métier par tenant.

Le `tenant_id` reste obligatoire dans le contexte applicatif et les artefacts
transverses.

## 15.3 Résolution

1. Authentification.
2. Résolution du tenant.
3. Vérification que l'utilisateur appartient au tenant.
4. Création du `TenantContext`.
5. Sélection du schéma PostgreSQL.
6. Accès aux repositories uniquement avec ce contexte.

Un `tenant_id` fourni par le client ne suffit jamais à changer de tenant.

## 15.4 Cache

Toutes les clés sont préfixées :

`tenant:{tenant_id}:...`

## 15.5 Jobs

Chaque job tenant-scoped contient `tenant_id`.

Un worker rejette un job sans contexte tenant valide.

## 15.6 Fichiers

Structure logique :

```text
tenants/{tenant_id}/logos/...
tenants/{tenant_id}/tickets/...
tenants/{tenant_id}/exports/...
```

## 15.7 Audit

Les audits métier tenant-scoped contiennent toujours `tenant_id`.

Les actions Super-Admin ciblant un tenant contiennent le tenant cible.

Les événements purement infrastructurels sans donnée métier restent séparés
des journaux applicatifs et ne doivent pas contenir de données tenant.

## 15.8 Sauvegarde

Les sauvegardes et restaurations doivent pouvoir être effectuées tenant par
tenant.

---

# 16. Super-Admin et mode support

Le Super-Admin ne bénéficie pas d'un accès silencieux à tous les détails.

Pour accéder aux données détaillées d'un tenant :

1. sélectionner le tenant ;
2. activer explicitement le mode support ;
3. saisir un motif obligatoire ;
4. créer un audit de début ;
5. limiter les permissions à la mission ;
6. créer un audit de fin.

L'interface doit afficher clairement le mode support.

---

# 17. API ouverte

Une API REST documentée par OpenAPI pourra exposer :

- clients ;
- commandes ;
- paiements ;
- rapports.

Chaque clé API :

- appartient à un seul tenant ;
- possède des scopes ;
- peut être révoquée ;
- est soumise aux quotas du plan.

Webhooks :

- commande créée ;
- statut modifié ;
- paiement reçu.

---

# 18. Offline-first et synchronisation

## 18.1 Données prioritaires

- création de commande ;
- opérations de caisse ;
- statuts de traitement ;
- consultations déjà synchronisées.

## 18.2 Mutation offline

Chaque mutation contient :

- `tenant_id` ;
- `device_id` ;
- UUID local ;
- idempotency key ;
- timestamp local ;
- type d'opération.

## 18.3 Règles de conflit

### Caisse

Append-only. Aucun écrasement.

### Statut commande

Le statut le plus avancé gagne.

`EN_ATTENTE < EN_COURS < PRET < LIVRE`

### Client

Fusion champ par champ selon le timestamp du champ.

### Commande créée offline

Pas de conflit métier : réconciliation de l'identifiant provisoire avec
l'identifiant serveur.

## 18.4 Indicateur

L'application affiche :

- synchronisé ;
- en attente ;
- erreur ;
- dernière synchronisation.

---

# 19. Sécurité et confidentialité

## 19.1 Authentification

- mots de passe/PIN hashés ;
- JWT ;
- expiration de session ;
- rotation/renouvellement selon politique ;
- protection contre brute force ;
- validation serveur.

## 19.2 Autorisation

RBAC côté serveur.

## 19.3 Données sensibles

- jamais dans les logs ;
- secrets stockés dans un gestionnaire sécurisé ;
- chiffrement lorsque requis ;
- tokens de paiement non stockés inutilement.

## 19.4 Audit

Audit des :

- changements de licence ;
- accès support ;
- modifications utilisateurs ;
- opérations financières sensibles ;
- exports ;
- changements de configuration ;
- API keys ;
- actions administratives.

## 19.5 Tests de sécurité

Obligatoires :

- cross-tenant ;
- ID forgé ;
- recherche cross-tenant ;
- export cross-tenant ;
- job cross-tenant ;
- cache cross-tenant ;
- fichier cross-tenant ;
- API key cross-tenant ;
- permissions RBAC.

---

# 20. Observabilité et exploitation

- logs structurés ;
- corrélation par request ID ;
- tenant context sur les logs applicatifs ;
- métriques API ;
- métriques queues ;
- erreurs de synchronisation ;
- erreurs notifications ;
- événements de licence ;
- alerting.

Aucun secret, token ou donnée client inutile ne doit apparaître dans les logs.

---

# 21. Tests et qualité

Chaque fonctionnalité doit disposer de :

1. tests unitaires ;
2. tests d'intégration ;
3. tests d'autorisation ;
4. tests d'isolation tenant ;
5. tests de contrat API si applicable ;
6. tests E2E pour les parcours critiques ;
7. tests offline/synchronisation si applicable.

## 21.1 Tests d'isolation obligatoires

Avec Tenant A et Tenant B :

- lecture d'un ID de B depuis A ;
- liste ;
- recherche par téléphone ;
- recherche par nom ;
- modification ;
- suppression ;
- export ;
- rapport ;
- cache ;
- queue ;
- fichier ;
- audit.

Résultat attendu : refus ou résultat vide correctement scoped.

---

# 22. Planning de développement

Le planning initial de 21 semaines est indicatif. Le développement Spec Kit
sera organisé par lots validés.

### Lot 1 — Fondations et sécurité

- monorepo ;
- auth ;
- tenancy ;
- isolation ;
- licences.

### Lot 2 — SaaS

- Super-Admin ;
- onboarding ;
- plans ;
- facturation.

### Lot 3 — Métier pressing

- clients ;
- services ;
- commandes ;
- caisse ;
- tickets.

### Lot 4 — Expérience

- notifications ;
- dashboard ;
- rapports ;
- Web ;
- mobile/offline.

### Lot 5 — Production

- sécurité ;
- audit ;
- API ;
- sauvegardes ;
- monitoring ;
- recette.

**Règle :** aucun lot ne passe au suivant tant que son quality gate n'est pas
vert.

---

# 23. Définition de terminé

Une fonctionnalité est terminée lorsque :

- la spec est approuvée ;
- les clarifications sont résolues ;
- le plan respecte la Constitution ;
- les tâches sont exécutées ;
- les tests passent ;
- les permissions sont testées ;
- l'isolation est testée si applicable ;
- la documentation est mise à jour ;
- aucun secret n'est exposé ;
- les risques restants sont documentés.

---

# 24. Glossaire

- **Tenant** : pressing client disposant d'un périmètre de données isolé.
- **Super-Administrateur** : administrateur de la plateforme SaaS.
- **Administrateur tenant** : administrateur d'un seul pressing.
- **RBAC** : contrôle d'accès par rôle.
- **JWT** : JSON Web Token.
- **RLS** : Row-Level Security PostgreSQL.
- **SaaS** : Software as a Service.
- **KPI** : indicateur clé de performance.
- **API** : interface de programmation applicative.
- **Webhook** : notification HTTP d'un système tiers.
- **ESC/POS** : protocole d'impression thermique.
- **QR Code** : code 2D.
- **Offline-first** : fonctionnement critique sans connexion permanente.
- **Idempotence** : répétition d'une opération sans duplication d'effet métier.
- **MRR** : revenu récurrent mensuel.
- **NINEA** : Numéro d'Identification Nationale des Entreprises et des Associations.

---

**Fin du cahier des charges — Fotall-Ma Pro — Version 2.0**
