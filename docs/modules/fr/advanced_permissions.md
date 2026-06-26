# Module Permissions avancées

## Statut

- Type : module major
- Valeur : 2 points
- État : implémenté et valide
- Pages principales : `/admin` et `/analyst`
- Helpers principaux : `requireAdminUser` et `requireRole`

Ce module fournit un contrôle d'accès par rôle pour ClearTrend. Les utilisateurs
standards, analystes et administrateurs ne voient pas et n'accèdent pas aux
mêmes surfaces applicatives. Les pages et routes API protégées vérifient les
permissions côté serveur, pas seulement dans l'interface.

## Rôles

Prisma définit trois rôles :

```text
USER
ADMIN
ANALYST
```

Chaque utilisateur possède :

- `role` : niveau de permission courant ;
- `bannedAt` : date optionnelle de bannissement.

Le schéma indexe aussi ces deux champs afin de filtrer efficacement les
utilisateurs dans les écrans admin et les contrôles d'autorisation.

## Matrice d'accès

| Surface | USER | ANALYST | ADMIN |
|---|---:|---:|---:|
| Dashboard | Oui | Oui | Oui |
| Paramètres de clé API | Oui | Oui | Oui |
| `/analyst` | Non | Oui | Oui |
| `/admin` | Non | Non | Oui |
| Routes API admin | Non | Non | Oui |
| Changer les rôles | Non | Non | Oui |
| Bannir/réactiver des utilisateurs | Non | Non | Oui |
| Supprimer des utilisateurs | Non | Non | Oui |

Le menu du dashboard suit la même matrice : `/admin` est affiché seulement aux
administrateurs, tandis que `/analyst` est affiché aux administrateurs et aux
analystes.

## Guards côté serveur

Fichier concerné :

- [`admin-auth.ts`](../../../web/src/lib/admin-auth.ts)

`requireAdminUser(req?)` protège les pages et routes réservées aux
administrateurs. Il peut lire l'identité depuis une session navigateur ou depuis
une requête API authentifiée.

`requireRole(roles)` protège les pages propres à certains rôles. La page
analyste utilise :

```ts
requireRole(["ADMIN", "ANALYST"]);
```

Les utilisateurs non authentifiés reçoivent `401` ou sont redirigés vers
`/login`. Les utilisateurs authentifiés sans le rôle requis reçoivent `403` ou
une réponse not-found, selon que le contrôle se fait dans une route API ou une
page serveur.

## Page admin

Fichier concerné :

- [`admin/page.tsx`](../../../web/src/app/admin/page.tsx)

La page admin est protégée côté serveur avant tout chargement de données
administrateur.

Elle fournit :

- liste des utilisateurs ;
- recherche et tri ;
- rôle, état, nombre de clés API et métadonnées de watchlist ;
- mise à jour de l'email et du nom affiché ;
- changement de rôle entre `USER`, `ANALYST` et `ADMIN` ;
- bannissement et réactivation ;
- suppression de compte.

Les actions admin sont implémentées comme server actions et répètent le contrôle
de rôle avant de modifier les données.

### Protection du dernier admin

Les changements de rôle et suppressions empêchent de retirer le dernier
administrateur. Si l'utilisateur ciblé est admin et que l'action laisserait le
système sans administrateur, l'action est ignorée.

Un administrateur ne peut pas non plus se bannir ou supprimer son propre compte
depuis le tableau admin.

## Page analyste

Fichier concerné :

- [`analyst/page.tsx`](../../../web/src/app/analyst/page.tsx)

La page analyste est accessible aux rôles `ANALYST` et `ADMIN`. Elle fournit une
vue opérationnelle en lecture seule sur l'activité d'analyse :

- total des analyses ;
- taux de complétion ;
- file active ;
- analyses échouées ;
- assets suivis ;
- rapports ;
- analyses récentes avec statut, tendance, recommandation, confiance et date de
  création.

Cela donne au rôle `ANALYST` une surface de permission concrète sans lui donner
les pouvoirs administrateur.

## API administrateur

Fichiers concernés :

- [`admin/ping/route.ts`](../../../web/src/app/api/admin/ping/route.ts)
- [`finance-refresh-rate/route.ts`](../../../web/src/app/api/admin/settings/finance-refresh-rate/route.ts)

Les routes API administrateur utilisent `requireAdminUser`. Un utilisateur
standard ou analyste avec une clé API valide reçoit `403 Forbidden` sur les
endpoints admin.

La route de fréquence de rafraîchissement finance supporte `GET`, `POST`,
`PUT`, `PATCH` et `DELETE`, mais toutes les méthodes exigent le rôle `ADMIN`.

## Utilisateurs bannis

Les utilisateurs bannis sont bloqués par les chemins d'authentification et de
chargement de profil :

- la connexion refuse les comptes bannis ;
- les lectures de profil exigent que `bannedAt` soit nul ;
- l'authentification par clé API refuse les propriétaires bannis.

Ainsi, un utilisateur banni ne peut pas continuer à utiliser le dashboard ou
l'API authentifiée avec une ancienne session ou clé.

## Validation manuelle

1. Se connecter comme utilisateur standard.
2. Confirmer que `/admin` est inaccessible.
3. Confirmer que `/analyst` est inaccessible.
4. Se connecter comme administrateur.
5. Ouvrir `/admin`.
6. Changer le rôle d'un utilisateur de test de `USER` vers `ANALYST`.
7. Se connecter comme cet analyste et confirmer que `/analyst` est accessible.
8. Confirmer que l'analyste ne peut toujours pas accéder à `/admin`.
9. Bannir puis réactiver un utilisateur de test.
10. Tenter de rétrograder ou supprimer le dernier admin et confirmer que
    l'action est bloquée.

## Fichiers principaux

| Fichier | Rôle |
|---|---|
| `web/prisma/schema.prisma` | Enum `Role`, champs `role` et `bannedAt` |
| `web/src/lib/admin-auth.ts` | Helpers `requireAdminUser` et `requireRole` |
| `web/src/app/admin/page.tsx` | Gestion admin des utilisateurs et rôles |
| `web/src/app/analyst/page.tsx` | Surface analyste en lecture seule |
| `web/src/app/api/admin/ping/route.ts` | Vérification API admin minimale |
| `web/src/app/api/admin/settings/finance-refresh-rate/route.ts` | API de réglage réservée admin |
| `web/src/components/DashboardClient.tsx` | Liens de navigation selon le rôle |
| `web/src/lib/auth-options.ts` | Refus des comptes bannis à la connexion |
| `web/src/lib/api-auth.ts` | Refus des clés API d'utilisateurs bannis |

## Limites

- La création de comptes par l'administrateur n'est pas exposée comme parcours
  séparé ; la création de compte reste gérée par l'inscription ou OAuth.
- Il s'agit d'un RBAC applicatif, pas d'un moteur de politiques complet avec des
  permissions personnalisées par ressource.

Ces limites ne retirent pas le comportement central du module : plusieurs rôles,
surfaces protégées, autorisation côté serveur, gestion des rôles, actions
administrateur et surface analyste distincte sont implémentés.
