# Module Complete Notification System

## Statut

- Type : module minor
- Valeur : 1 point
- État : implémenté
- Sujet : complete notification system for all creation, update, and deletion
  actions
- Périmètre : notifications UI + persistance en base pour les actions de
  création, modification et suppression
- Composant : `web/src/components/ui/Notifications.tsx`
- Endpoint : `POST /api/notifications`

Ce module fournit un système centralisé de notifications pour les actions
importantes de l'application. Une action de création, modification ou
suppression peut afficher un toast utilisateur et enregistrer le même événement
dans la table PostgreSQL `notifications`.

Le module est volontairement centralisé : les composants fonctionnels ne
manipulent pas Prisma directement. Ils appellent `notify(...)`, et le provider
se charge de l'affichage ainsi que de l'envoi vers l'endpoint backend.

## Parcours utilisateur

Dans l'application, un composant client peut appeler :

```ts
const { notify } = useNotifications();

notify({
  title: "Watchlist updated",
  body: "AAPL was added.",
  tone: "success",
  type: "WATCHLIST_UPDATED",
  entityType: "watchlist",
  entityId: watchlistId,
});
```

Résultat :

1. un toast apparaît immédiatement dans l'interface ;
2. le navigateur envoie un `POST /api/notifications` ;
3. la route vérifie la session utilisateur ;
4. une ligne est créée dans la table `notifications`.

L'affichage du toast ne dépend pas de la réponse serveur. Si l'utilisateur n'est
pas connecté ou si l'écriture échoue, le toast reste visible mais rien n'est
stocké.

## Actions couvertes

Le module couvre les actions de création, modification et suppression via les
types Prisma `NotificationType`.
 
| Famille | Création | Modification | Suppression |
|---|---|---|---|
| Watchlist | `WATCHLIST_CREATED` | `WATCHLIST_UPDATED` | `WATCHLIST_DELETED` |
| Analyse | `ANALYSIS_CREATED` | `ANALYSIS_UPDATED` | `ANALYSIS_FAILED` pour un échec |
| Clé API | `API_KEY_CREATED` | `SYSTEM` si besoin | `API_KEY_REVOKED` |
| Export | `EXPORT_READY` | `SYSTEM` si besoin | `SYSTEM` si besoin |
| Autre action | `SYSTEM` | `SYSTEM` | `SYSTEM` |

Quand une nouvelle action CRUD est ajoutée dans l'application, elle doit appeler
`notify(...)` avec :

- un `title` clair ;
- un `body` facultatif ;
- un `type` adapté ;
- `entityType` et `entityId` lorsque l'action concerne un objet identifiable.

Exemples de classification :

```ts
notify({
  title: "Report created",
  body: "A new report is available.",
  type: "EXPORT_READY",
  entityType: "report",
  entityId: reportId,
});
```

```ts
notify({
  title: "Watchlist deleted",
  body: "The watchlist was removed.",
  type: "WATCHLIST_DELETED",
  entityType: "watchlist",
  entityId: watchlistId,
});
```

## API côté frontend

Le hook est exposé par :

```ts
import { useNotifications } from "@/components/ui/Notifications";
```

Champs acceptés :

```ts
notify({
  title: string,
  body?: string,
  tone?: "error" | "info" | "success" | "warning",
  durationMs?: number,
  type?: NotificationType,
  entityType?: string,
  entityId?: string,
  persist?: boolean,
});
```

### Champs UI

- `title` : texte principal du toast.
- `body` : texte secondaire facultatif.
- `tone` : style visuel du toast. Valeur par défaut : `info`.
- `durationMs` : durée d'affichage. Valeur par défaut : `5000`.

### Champs base de données

- `type` : type Prisma `NotificationType`. Valeur par défaut : `SYSTEM`.
- `entityType` : type d'objet lié, par exemple `watchlist`, `asset`, `report`.
- `entityId` : identifiant de l'objet lié.
- `persist` : mettre `false` pour afficher un toast sans écrire en base.

Exemple sans persistance :

```ts
notify({
  title: "Copied",
  body: "The value was copied locally.",
  persist: false,
});
```

## Notifications après navigation

Le provider expose aussi :

```ts
notifyAfterNavigation(notification);
```

Cette fonction place la notification en `sessionStorage`. Après le changement de
page, le provider relit la notification et appelle `notify(...)`.

Comme l'appel final passe par `notify(...)`, la notification est aussi envoyée à
`POST /api/notifications`, sauf si `persist: false` est présent.

## Endpoint serveur

Endpoint :

```text
POST /api/notifications
Content-Type: application/json
```

Body :

```json
{
  "title": "Watchlist updated",
  "body": "AAPL was added.",
  "type": "WATCHLIST_UPDATED",
  "entityType": "watchlist",
  "entityId": "..."
}
```

La route :

1. charge le profil courant avec `getCurrentUserProfile()`;
2. refuse les utilisateurs non authentifiés avec `401`;
3. valide la présence de `title`;
4. normalise les champs facultatifs;
5. crée une ligne Prisma `notification`.

Réponse nominale :

```json
{
  "id": "notification-id"
}
```

Code HTTP :

| Situation | Code |
|---|---:|
| Notification créée | `201` |
| Utilisateur non connecté | `401` |
| Body invalide ou titre absent | `400` |

## Données stockées

Modèle Prisma :

```text
Notification
```

Champs utilisés :

| Champ | Source |
|---|---|
| `userId` | profil courant |
| `type` | `notification.type` ou `SYSTEM` |
| `entityType` | `notification.entityType` |
| `entityId` | `notification.entityId` |
| `title` | `notification.title` |
| `body` | `notification.body` |
| `readAt` | `null` à la création |
| `createdAt` | généré par Prisma |
| `updatedAt` | généré par Prisma |

Types supportés :

```text
WATCHLIST_CREATED
WATCHLIST_UPDATED
WATCHLIST_DELETED
ANALYSIS_CREATED
ANALYSIS_UPDATED
ANALYSIS_FAILED
API_KEY_CREATED
API_KEY_REVOKED
EXPORT_READY
SYSTEM
```

Un type inconnu est remplacé par `SYSTEM`.

## Sécurité

- L'écriture en base exige une session utilisateur.
- Le client ne choisit jamais `userId`; il vient du profil courant.
- Les champs texte sont tronqués côté serveur :
  - `title` : 160 caractères ;
  - `body` : 1000 caractères ;
  - `entityType` : 80 caractères ;
  - `entityId` : 120 caractères.
- Le toast client reste best effort : une erreur réseau ou un `401` n'interrompt
  pas l'interface.

## Validation manuelle

1. Démarrer l'application.
2. Se connecter avec un utilisateur.
3. Déclencher une action de création, modification ou suppression qui appelle
   `notify(...)`.
4. Vérifier que le toast apparaît.
5. Vérifier que la table `notifications` contient une nouvelle ligne.

Cas à tester :

- création : par exemple ajout ou import d'éléments de watchlist ;
- modification : par exemple mise à jour d'une watchlist, d'un profil ou d'une
  clé API ;
- suppression : par exemple suppression d'une entrée ou révocation d'une clé ;
- notification normale avec un `type` adapté ;
- notification avec `entityType` et `entityId` ;
- notification avec `persist: false`;
- utilisateur non connecté : toast visible, aucune ligne créée.

## Fichiers principaux

```text
web/src/components/ui/Notifications.tsx
web/src/components/ui/Toast.tsx
web/src/app/api/notifications/route.ts
web/prisma/schema.prisma
```
