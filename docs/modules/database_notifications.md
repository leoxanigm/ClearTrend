# Module Complete Notification System

## Statut

- Type : module minor
- Valeur : 1 point
- Etat : implemente
- Sujet : complete notification system for all creation, update, and deletion
  actions
- Perimetre : notifications UI + persistance en base pour les actions de
  creation, modification et suppression
- Composant : `web/src/components/ui/Notifications.tsx`
- Endpoint : `POST /api/notifications`

Ce module fournit un systeme centralise de notifications pour les actions
importantes de l'application. Une action de creation, modification ou
suppression peut afficher un toast utilisateur et enregistrer le meme evenement
dans la table PostgreSQL `notifications`.

Le module est volontairement centralise : les composants fonctionnels ne
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

Resultat :

1. un toast apparait immediatement dans l'interface ;
2. le navigateur envoie un `POST /api/notifications` ;
3. la route verifie la session utilisateur ;
4. une ligne est creee dans la table `notifications`.

L'affichage du toast ne depend pas de la reponse serveur. Si l'utilisateur n'est
pas connecte ou si l'ecriture echoue, le toast reste visible mais rien n'est
stocke.

## Actions couvertes

Le module couvre les actions de creation, modification et suppression via les
types Prisma `NotificationType`.

| Famille | Creation | Modification | Suppression |
|---|---|---|---|
| Watchlist | `WATCHLIST_CREATED` | `WATCHLIST_UPDATED` | `WATCHLIST_DELETED` |
| Analyse | `ANALYSIS_CREATED` | `ANALYSIS_UPDATED` | `ANALYSIS_FAILED` pour un echec |
| Cle API | `API_KEY_CREATED` | `SYSTEM` si besoin | `API_KEY_REVOKED` |
| Export | `EXPORT_READY` | `SYSTEM` si besoin | `SYSTEM` si besoin |
| Autre action | `SYSTEM` | `SYSTEM` | `SYSTEM` |

Quand une nouvelle action CRUD est ajoutee dans l'application, elle doit appeler
`notify(...)` avec :

- un `title` clair ;
- un `body` facultatif ;
- un `type` adapte ;
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

## API cote frontend

Le hook est expose par :

```ts
import { useNotifications } from "@/components/ui/Notifications";
```

Champs acceptes :

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
- `tone` : style visuel du toast. Valeur par defaut : `info`.
- `durationMs` : duree d'affichage. Valeur par defaut : `5000`.

### Champs base de donnees

- `type` : type Prisma `NotificationType`. Valeur par defaut : `SYSTEM`.
- `entityType` : type d'objet lie, par exemple `watchlist`, `asset`, `report`.
- `entityId` : identifiant de l'objet lie.
- `persist` : mettre `false` pour afficher un toast sans ecrire en base.

Exemple sans persistance :

```ts
notify({
  title: "Copied",
  body: "The value was copied locally.",
  persist: false,
});
```

## Notifications apres navigation

Le provider expose aussi :

```ts
notifyAfterNavigation(notification);
```

Cette fonction place la notification en `sessionStorage`. Apres le changement de
page, le provider relit la notification et appelle `notify(...)`.

Comme l'appel final passe par `notify(...)`, la notification est aussi envoyee a
`POST /api/notifications`, sauf si `persist: false` est present.

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
2. refuse les utilisateurs non authentifies avec `401`;
3. valide la presence de `title`;
4. normalise les champs facultatifs;
5. cree une ligne Prisma `notification`.

Reponse nominale :

```json
{
  "id": "notification-id"
}
```

Code HTTP :

| Situation | Code |
|---|---:|
| Notification creee | `201` |
| Utilisateur non connecte | `401` |
| Body invalide ou titre absent | `400` |

## Donnees stockees

Modele Prisma :

```text
Notification
```

Champs utilises :

| Champ | Source |
|---|---|
| `userId` | profil courant |
| `type` | `notification.type` ou `SYSTEM` |
| `entityType` | `notification.entityType` |
| `entityId` | `notification.entityId` |
| `title` | `notification.title` |
| `body` | `notification.body` |
| `readAt` | `null` a la creation |
| `createdAt` | genere par Prisma |
| `updatedAt` | genere par Prisma |

Types supportes :

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

Un type inconnu est remplace par `SYSTEM`.

## Recherche

Les notifications persistantes sont deja prises en compte par la recherche
globale via :

```text
GET /api/search?type=notifications
```

La recherche filtre les notifications par `userId`. Un utilisateur ne voit donc
que ses propres notifications.

## Securite

- L'ecriture en base exige une session utilisateur.
- Le client ne choisit jamais `userId`; il vient du profil courant.
- Les champs texte sont tronques cote serveur :
  - `title` : 160 caracteres ;
  - `body` : 1000 caracteres ;
  - `entityType` : 80 caracteres ;
  - `entityId` : 120 caracteres.
- Le toast client reste best effort : une erreur reseau ou un `401` n'interrompt
  pas l'interface.

## Validation manuelle

1. Demarrer l'application.
2. Se connecter avec un utilisateur.
3. Declencher une action de creation, modification ou suppression qui appelle
   `notify(...)`.
4. Verifier que le toast apparait.
5. Verifier que la table `notifications` contient une nouvelle ligne.
6. Verifier la recherche :

```text
/api/search?type=notifications
```

Cas a tester :

- creation : par exemple ajout ou import d'elements de watchlist ;
- modification : par exemple mise a jour d'une watchlist, d'un profil ou d'une
  cle API ;
- suppression : par exemple suppression d'une entree ou revocation d'une cle ;
- notification normale avec un `type` adapte ;
- notification avec `entityType` et `entityId` ;
- notification avec `persist: false`;
- utilisateur non connecte : toast visible, aucune ligne creee.

## Fichiers principaux

```text
web/src/components/ui/Notifications.tsx
web/src/components/ui/Toast.tsx
web/src/app/api/notifications/route.ts
web/prisma/schema.prisma
web/src/app/api/search/route.ts
```
