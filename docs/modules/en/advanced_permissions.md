# Module Advanced Permissions

## Status

- Type: major module
- Value: 2 points
- Status: implemented and valid
- Main pages: `/admin` and `/analyst`
- Main helpers: `requireAdminUser` and `requireRole`

This module provides role-based access control for ClearTrend. Regular users,
analysts, and administrators do not see or access the same application surfaces.
Protected pages and API routes check permissions server-side, not only in the
UI.

## Roles

Prisma defines three roles:

```text
USER
ADMIN
ANALYST
```

Each user has:

- `role`: current permission level;
- `bannedAt`: optional ban timestamp.

The schema also indexes both fields so admin screens and authorization checks
can filter users efficiently.

## Access Matrix

| Surface | USER | ANALYST | ADMIN |
|---|---:|---:|---:|
| Dashboard | Yes | Yes | Yes |
| API key settings | Yes | Yes | Yes |
| `/analyst` | No | Yes | Yes |
| `/admin` | No | No | Yes |
| Admin API routes | No | No | Yes |
| Change user roles | No | No | Yes |
| Ban/unban users | No | No | Yes |
| Delete users | No | No | Yes |

The dashboard menu follows the same matrix: `/admin` is shown only to admins,
while `/analyst` is shown to admins and analysts.

## Server-Side Guards

Relevant file:

- [`admin-auth.ts`](../../../web/src/lib/admin-auth.ts)

`requireAdminUser(req?)` protects administrator-only routes and pages. It can
read identity from a browser session or from an authenticated API request.

`requireRole(roles)` protects role-specific pages. The analyst page uses:

```ts
requireRole(["ADMIN", "ANALYST"]);
```

Unauthenticated users receive `401` or are redirected to `/login`. Authenticated
users without the required role receive `403` or a not-found response,
depending on whether the check happens in an API route or a server page.

## Admin Page

Relevant file:

- [`admin/page.tsx`](../../../web/src/app/admin/page.tsx)

The admin page is protected on the server before any admin data is loaded.

It provides:

- user listing;
- search and sorting;
- role, status, API-key count, and watchlist metadata;
- profile update for email and display name;
- role update between `USER`, `ANALYST`, and `ADMIN`;
- ban and unban actions;
- account deletion.

Admin actions are implemented as server actions and repeat the role check before
mutating data.

### Last Admin Protection

Role changes and deletions prevent removing the last administrator. If the
target user is an admin and would leave the system with zero admins, the action
is ignored.

Admins also cannot ban or delete their own account from the admin table.

## Analyst Page

Relevant file:

- [`analyst/page.tsx`](../../../web/src/app/analyst/page.tsx)

The analyst page is accessible to `ANALYST` and `ADMIN` roles. It gives a
read-only operational view over analysis activity:

- total analyses;
- completion rate;
- active queue;
- failed analyses;
- tracked assets;
- reports;
- recent analysis runs with status, trend, recommendation, confidence, and
  creation date.

This gives the `ANALYST` role a concrete permission surface without granting
administrator powers.

## Administrator API

Relevant files:

- [`admin/ping/route.ts`](../../../web/src/app/api/admin/ping/route.ts)
- [`finance-refresh-rate/route.ts`](../../../web/src/app/api/admin/settings/finance-refresh-rate/route.ts)

Administrator API routes use `requireAdminUser`. A regular user or analyst with
a valid API key receives `403 Forbidden` on admin endpoints.

The finance refresh rate route supports `GET`, `POST`, `PUT`, `PATCH`, and
`DELETE`, but all methods require the `ADMIN` role.

## Banned Users

Banned users are blocked by authentication and profile-loading paths:

- sign-in refuses banned accounts;
- profile reads require `bannedAt` to be null;
- API-key authentication rejects banned owners.

This ensures a banned user cannot keep using the dashboard or authenticated API
with an old session or key.

## Manual Validation

Recommended demo:

1. Sign in as a regular user.
2. Confirm `/admin` is not accessible.
3. Confirm `/analyst` is not accessible.
4. Sign in as an admin.
5. Open `/admin`.
6. Change a test user role from `USER` to `ANALYST`.
7. Sign in as that analyst and confirm `/analyst` is accessible.
8. Confirm the analyst still cannot access `/admin`.
9. Ban and unban a test user.
10. Try to demote or delete the last admin and confirm the action is blocked.

## Main Files

| File | Role |
|---|---|
| `web/prisma/schema.prisma` | `Role` enum, `role`, and `bannedAt` fields |
| `web/src/lib/admin-auth.ts` | `requireAdminUser` and `requireRole` helpers |
| `web/src/app/admin/page.tsx` | Admin user management and role actions |
| `web/src/app/analyst/page.tsx` | Analyst-only read surface |
| `web/src/app/api/admin/ping/route.ts` | Minimal admin API check |
| `web/src/app/api/admin/settings/finance-refresh-rate/route.ts` | Admin-only settings API |
| `web/src/components/DashboardClient.tsx` | Role-aware navigation links |
| `web/src/lib/auth-options.ts` | Banned-account sign-in checks |
| `web/src/lib/api-auth.ts` | API-key rejection for banned users |

## Limits

- Admin-created accounts are not exposed as a separate flow; account creation
  remains handled by sign-up or OAuth.
- This is application-level RBAC, not a full policy engine with per-resource
  custom permission rules.

These limits do not remove the core module behavior: multiple roles, protected
surfaces, server-side authorization, role management, administrator actions, and
a distinct analyst permission surface are implemented.
