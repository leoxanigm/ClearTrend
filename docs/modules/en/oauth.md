# Module OAuth 2.0

## Status

- Type: minor module
- Value: 1 point
- Status: implemented and valid
- Main page: `/login`
- Main route: `/api/auth/[...nextauth]`
- Supported providers: Google, GitHub, and 42 School

This module adds remote authentication to ClearTrend. Users can create or reuse
an account with an external OAuth provider while the local email/password login
remains available.

## Subject Requirements

The subject requires a standard OAuth 2.0 authentication flow.

ClearTrend implements this requirement with NextAuth, provider-specific client
credentials, callback routes, and PostgreSQL-backed user persistence.

## Requirements Mapping

| Requirement | ClearTrend implementation |
|---|---|
| OAuth 2.0 login | NextAuth OAuth providers are mounted under `/api/auth` |
| External provider support | Google, GitHub, and 42 School are configured |
| User account creation | The sign-in callback creates a `User` row on first OAuth login |
| Returning user login | Existing OAuth users are matched by provider and provider account id |
| Secure secrets | Provider credentials and `NEXTAUTH_SECRET` are read from `.env` |
| User-facing entry point | `/login` displays one button per configured provider |
| Session integration | JWT and session callbacks expose the internal user id |

## Architecture

```text
Login page
      |
      | fetch /api/auth/providers
      v
NextAuth provider list
      |
      | configured providers only
      v
OAuth button
      |
      | signIn(provider, callbackUrl=/dashboard)
      v
External provider authorization
      |
      | /api/auth/callback/{provider}
      v
NextAuth signIn callback
      |
      +-- validate email, provider, and provider account id
      +-- reject banned OAuth account
      +-- create or update the matching user
      +-- store internal user id in the session token
      |
      v
Dashboard
```

The browser only talks to the Next.js `web` service. OAuth secrets are never sent
to the client.

## Provider Configuration

Relevant files:

- [`auth-options.ts`](../../../web/src/lib/auth-options.ts)
- [`.env.example`](../../../.env.example)

OAuth and session settings are read from `.env`:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=change-this-development-secret

AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret
AUTH_GITHUB_ID=your_github_client_id
AUTH_GITHUB_SECRET=your_github_client_secret
AUTH_42_SCHOOL_ID=your_42_uid
AUTH_42_SCHOOL_SECRET=your_42_secret
```

Use a strong secret outside local development:

```sh
openssl rand -base64 32
```

Only providers with real credentials are enabled. Empty values, `change-me`, and
placeholder values starting with `your_` are ignored.

## Callback URLs

Register these callback URLs in the provider developer console:

| Provider | NextAuth id | Callback URL |
|---|---|---|
| Google | `google` | `${NEXTAUTH_URL}/api/auth/callback/google` |
| GitHub | `github` | `${NEXTAUTH_URL}/api/auth/callback/github` |
| 42 School | `42-school` | `${NEXTAUTH_URL}/api/auth/callback/42-school` |

For the default local setup, `${NEXTAUTH_URL}` is `http://localhost:3000`.

## Login Page

Relevant file:

- [`OAuthButtons.tsx`](../../../web/src/app/login/OAuthButtons.tsx)

The login page loads `/api/auth/providers` with `cache: "no-store"`. It then
renders only the providers returned by NextAuth.

The current provider buttons are:

| Provider | Icon |
|---|---|
| Google | `web/public/google.svg` |
| GitHub | `web/public/github.svg` |
| 42 School | `web/public/42.svg` |

Clicking a provider starts:

```ts
signIn(provider.id, { callbackUrl: "/dashboard" });
```

If no OAuth provider is configured, the OAuth button group is hidden and the
credentials form remains usable.

## User Persistence

Relevant files:

- [`schema.prisma`](../../../web/prisma/schema.prisma)
- [`profile.ts`](../../../web/src/lib/profile.ts)

OAuth identity is stored directly on the `User` model:

```prisma
model User {
  id                     String  @id @default(uuid())
  email                  String  @unique
  oauthProvider          String?
  oauthProviderAccountId String?
  passwordHash           String?
  displayName            String?
  avatarUrl              String?

  @@unique([oauthProvider, oauthProviderAccountId])
}
```

The stable OAuth identity is:

```text
oauthProvider + oauthProviderAccountId
```

This prevents accounts from different providers from being merged only because
they expose the same email address.

On first sign-in, ClearTrend stores:

- provider name;
- provider account id;
- provider email;
- display name from the provider, or the email prefix;
- avatar URL when the provider returns one.

On later sign-ins, the callback updates the stored email for the same provider
account. It does not overwrite the local display name or avatar customization.

## Session Data

The NextAuth callbacks add project-specific identity fields to the JWT and
session:

```text
user.id
user.oauthProvider
user.oauthProviderAccountId
```

Application code can then load the current profile by internal user id. If the
session has no internal id yet, `profile.ts` can recover the profile from the
OAuth provider pair.

## Account Linking Rules

OAuth accounts are intentionally not auto-linked to existing email/password
accounts.

If a user already has a credentials account with the same email address, OAuth
sign-in still uses the provider identity as the account key. Manual migration or
explicit account linking would need a separate feature.

## Banned Users

The OAuth sign-in callback checks whether the matching OAuth account is banned
before creating or updating the user. A banned OAuth user is redirected to:

```text
/login?error=BANNED
```

Protected pages and API routes also reject banned users through the normal
profile and authorization helpers.

## Manual Validation

Recommended demo:

1. Start the stack.
2. Open `/login`.
3. Confirm that only configured OAuth provider buttons are visible.
4. Sign in with Google.
5. Confirm redirect to `/dashboard`.
6. Confirm the database row contains `oauthProvider = google`.
7. Sign out and sign in again with Google.
8. Confirm the same user row is reused.
9. Repeat with GitHub and 42 School when credentials are available.
10. Remove one provider's credentials and confirm its button disappears.

The provider list can also be checked from the browser or terminal:

```sh
curl -s http://localhost:3000/api/auth/providers
```

## Troubleshooting

| Symptom | Likely cause | Check |
|---|---|---|
| Provider button is missing | Missing or placeholder credentials | `.env` provider id and secret |
| Provider redirects fail | Callback URL mismatch | Provider console callback URL |
| Session is unstable | Missing or changing NextAuth secret | `NEXTAUTH_SECRET` |
| OAuth sign-in returns to login | Provider did not return email or account id | `web` logs |
| Existing credentials email conflicts | OAuth is not auto-linked by email | `users.email` uniqueness |

## Main Files

| File | Role |
|---|---|
| `web/src/lib/auth-options.ts` | NextAuth providers, sign-in, JWT, and session callbacks |
| `web/src/app/api/auth/[...nextauth]/route.ts` | NextAuth route handler |
| `web/src/app/login/OAuthButtons.tsx` | Dynamic OAuth provider buttons |
| `web/src/app/login/page.tsx` | Login page that includes credentials and OAuth entry points |
| `web/src/lib/profile.ts` | Current user identity and profile loading |
| `web/prisma/schema.prisma` | OAuth fields and provider-account unique constraint |
| `.env.example` | Documented provider credential variables |
| `web/public/google.svg` | Google button icon |
| `web/public/github.svg` | GitHub button icon |
| `web/public/42.svg` | 42 School button icon |

## Limits

- OAuth sign-in requires the provider to return an email address.
- OAuth users are not automatically linked to credentials users by email.
- Only providers configured in code are supported.
- The implementation uses NextAuth-managed OAuth sessions, not a custom OAuth
  authorization server.

These limits do not remove the core module behavior: external OAuth sign-in,
provider callbacks, account creation, returning-user login, and session
integration are implemented.
