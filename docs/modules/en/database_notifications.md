# Module Complete Notification System

## Status

- Type: minor module
- Value: 1 point
- Status: implemented
- Subject: complete notification system for all creation, update, and deletion
  actions
- Scope: UI notifications + database persistence for creation, update, and
  deletion actions
- Component: `web/src/components/ui/Notifications.tsx`
- Endpoint: `POST /api/notifications`

This module provides a centralized notification system for important
application actions. A creation, update, or deletion action can display a user
toast and record the same event in the PostgreSQL `notifications` table.

The module is intentionally centralized: feature components do not manipulate
Prisma directly. They call `notify(...)`, and the provider handles both display
and delivery to the backend endpoint.

## User Flow

In the application, a client component can call:

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

Result:

1. a toast appears immediately in the interface;
2. the browser sends `POST /api/notifications`;
3. the route checks the user session;
4. a row is created in the `notifications` table.

Toast display does not depend on the server response. If the user is not signed
in or if the write fails, the toast remains visible but nothing is stored.

## Covered Actions

The module covers creation, update, and deletion actions through the Prisma
`NotificationType` values.

| Family | Creation | Update | Deletion |
|---|---|---|---|
| Watchlist | `WATCHLIST_CREATED` | `WATCHLIST_UPDATED` | `WATCHLIST_DELETED` |
| Analysis | `ANALYSIS_CREATED` | `ANALYSIS_UPDATED` | `ANALYSIS_FAILED` for a failure |
| API key | `API_KEY_CREATED` | `SYSTEM` if needed | `API_KEY_REVOKED` |
| Export | `EXPORT_READY` | `SYSTEM` if needed | `SYSTEM` if needed |
| Other action | `SYSTEM` | `SYSTEM` | `SYSTEM` |

When a new CRUD action is added to the application, it should call
`notify(...)` with:

- a clear `title`;
- an optional `body`;
- an appropriate `type`;
- `entityType` and `entityId` when the action concerns an identifiable object.

Classification examples:

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

## Frontend API

The hook is exposed by:

```ts
import { useNotifications } from "@/components/ui/Notifications";
```

Accepted fields:

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

### UI Fields

- `title`: main toast text.
- `body`: optional secondary text.
- `tone`: visual toast style. Default value: `info`.
- `durationMs`: display duration. Default value: `5000`.

### Database Fields

- `type`: Prisma `NotificationType`. Default value: `SYSTEM`.
- `entityType`: linked object type, for example `watchlist`, `asset`, or
  `report`.
- `entityId`: linked object identifier.
- `persist`: set to `false` to display a toast without writing to the database.

Example without persistence:

```ts
notify({
  title: "Copied",
  body: "The value was copied locally.",
  persist: false,
});
```

## Notifications After Navigation

The provider also exposes:

```ts
notifyAfterNavigation(notification);
```

This function stores the notification in `sessionStorage`. After the page
change, the provider reads it back and calls `notify(...)`.

Because the final call goes through `notify(...)`, the notification is also
sent to `POST /api/notifications`, unless `persist: false` is present.

## Server Endpoint

Endpoint:

```text
POST /api/notifications
Content-Type: application/json
```

Body:

```json
{
  "title": "Watchlist updated",
  "body": "AAPL was added.",
  "type": "WATCHLIST_UPDATED",
  "entityType": "watchlist",
  "entityId": "..."
}
```

The route:

1. loads the current profile with `getCurrentUserProfile()`;
2. rejects unauthenticated users with `401`;
3. validates that `title` is present;
4. normalizes optional fields;
5. creates a Prisma `notification` row.

Nominal response:

```json
{
  "id": "notification-id"
}
```

HTTP status:

| Situation | Code |
|---|---:|
| Notification created | `201` |
| User not signed in | `401` |
| Invalid body or missing title | `400` |

## Stored Data

Prisma model:

```text
Notification
```

Fields used:

| Field | Source |
|---|---|
| `userId` | current profile |
| `type` | `notification.type` or `SYSTEM` |
| `entityType` | `notification.entityType` |
| `entityId` | `notification.entityId` |
| `title` | `notification.title` |
| `body` | `notification.body` |
| `readAt` | `null` on creation |
| `createdAt` | generated by Prisma |
| `updatedAt` | generated by Prisma |

Supported types:

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

An unknown type is replaced with `SYSTEM`.

## Security

- Database writes require a user session.
- The client never chooses `userId`; it comes from the current profile.
- Text fields are truncated server-side:
  - `title`: 160 characters;
  - `body`: 1000 characters;
  - `entityType`: 80 characters;
  - `entityId`: 120 characters.
- Client toasts remain best effort: a network error or `401` does not interrupt
  the interface.

## Manual Validation

1. Start the application.
2. Sign in with a user.
3. Trigger a creation, update, or deletion action that calls `notify(...)`.
4. Verify that the toast appears.
5. Verify that the `notifications` table contains a new row.

Cases to test:

- creation: for example adding or importing watchlist items;
- update: for example updating a watchlist, profile, or API key;
- deletion: for example deleting an entry or revoking a key;
- normal notification with an appropriate `type`;
- notification with `entityType` and `entityId`;
- notification with `persist: false`;
- unauthenticated user: toast visible, no row created.

## Main Files

```text
web/src/components/ui/Notifications.tsx
web/src/components/ui/Toast.tsx
web/src/app/api/notifications/route.ts
web/prisma/schema.prisma
```
