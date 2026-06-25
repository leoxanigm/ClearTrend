# Secure Public API

## Status

- Type: Major module
- Value: 2 points
- Status: Implemented
- Web documentation: `/api-docs`
- API key settings: `/settings/api`
- Test script: `tests/api/public-api-tests.sh`

## Subject Requirements

The subject requires:

- a public API that interacts with the database;
- authentication using a secured API key;
- rate limiting;
- documentation;
- at least five endpoints;
- support for `GET`, `POST`, `PUT`, and `DELETE`.

ClearTrend implements these requirements through authenticated Next.js API
routes, PostgreSQL-backed API keys, per-account request limits, and
internationalized web documentation.

## Requirements Mapping

| Requirement | ClearTrend implementation |
|---|---|
| Public API | Next.js routes under `/api` can be called by external clients |
| Database interaction | Watchlist, search, API key, user, and admin setting routes use PostgreSQL |
| Secured API key | Random API keys are stored only as SHA-256 hashes |
| Rate limiting | 120 authenticated requests per minute per account |
| Documentation | `/api-docs` provides authentication instructions and curl examples |
| At least five endpoints | More than five authenticated routes and twenty method/path operations |
| Required HTTP methods | `GET`, `POST`, `PUT`, and `DELETE` are implemented |
| Administration security | Admin routes additionally verify the `ADMIN` role |

## Architecture

```text
External client
      |
      | HTTPS request
      | Authorization: Bearer <api_key>
      | or X-API-Key: <api_key>
      v
Next.js API route
      |
      v
API identity validation
      |
      +-- hash supplied API key
      +-- find matching key in PostgreSQL
      +-- reject revoked keys
      +-- reject banned users
      +-- update lastUsedAt
      |
      v
Rate limiter
      |
      +-- 120 requests per minute
      +-- account-based API key bucket
      +-- HTTP 429 when exceeded
      |
      v
Route authorization and input validation
      |
      +-- regular authenticated route
      +-- optional ADMIN role check
      |
      v
PostgreSQL or internal analysis service
```

The browser and external clients only access the Next.js backend. Internal
analysis service addresses and database credentials are never exposed.

## API Key Lifecycle

Relevant files:

- `web/src/app/api/account/api-key/route.ts`
- `web/src/components/ApiKeySettingsClient.tsx`
- `web/src/lib/api-auth.ts`
- `web/prisma/schema.prisma`

An authenticated user can create one API key from `/settings/api`.

The generated key uses:

```text
ct_<32 random bytes encoded as base64url>
```

The complete secret is returned only once. The database stores:

- the owning user ID;
- a SHA-256 hash of the key;
- a short display prefix;
- its creation date;
- its last-use date;
- an optional revocation date.

The plaintext key is not stored. When a client submits a key, the backend hashes
it and searches for the matching hash.

Deleting the API key removes it from the database and immediately prevents
further authentication with that key.

## Authentication

API keys can be supplied with either header:

```http
Authorization: Bearer ct_example
```

or:

```http
X-API-Key: ct_example
```

The same API routes accept a browser session so the ClearTrend interface can
reuse the backend API.

Authentication returns:

- `401 Unauthorized` when no valid session or API key exists;
- `404 Not Found` when the associated profile no longer exists;
- `403 Forbidden` when a valid user attempts an administrator-only operation.

Users with `bannedAt` set are rejected even if their API key is otherwise valid.

## Rate Limiting

Relevant files:

- `web/src/lib/api-auth.ts`
- `web/src/lib/rate-limit.ts`

Authenticated API calls are limited to:

```text
120 requests per 60 seconds per account
```

API-key requests use the authenticated user ID as the bucket identifier.
Browser-session requests use the user ID and client IP address.

When the limit is exceeded, the API returns:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: <seconds>
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 0
X-RateLimit-Reset: <Unix timestamp>
Content-Type: application/json
```

Example body:

```json
{
  "error": "Rate limit exceeded."
}
```

The current limiter is stored in the memory of the Next.js process. This is
appropriate for the project's single `web` container. A horizontally scaled
deployment would require a shared limiter such as Redis or PostgreSQL.

## Core Database Endpoints

These five operations directly satisfy the minimum endpoint and HTTP method
requirements:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/assets/watchlist` | Read the authenticated user's watchlist |
| `POST` | `/api/assets/watchlist` | Add one symbol |
| `PUT` | `/api/assets/watchlist` | Replace the complete watchlist |
| `DELETE` | `/api/assets/watchlist` | Remove one symbol or clear the watchlist |
| `GET` | `/api/search` | Search database-backed assets and analyses |

The watchlist routes read and update the authenticated user's
`favoriteSymbols` field in PostgreSQL. The search route uses Prisma queries,
filters, sorting, pagination, and bounded result limits.

## Complete Endpoint Surface

### Public Health

| Method | Path | Authorization |
|---|---|---|
| `GET` | `/api/health` | Public |

### Watchlist

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/assets/watchlist` | Read the watchlist |
| `POST` | `/api/assets/watchlist` | Add a symbol |
| `PUT` | `/api/assets/watchlist` | Replace all symbols |
| `PATCH` | `/api/assets/watchlist` | Change one favorite state |
| `DELETE` | `/api/assets/watchlist` | Remove a symbol or clear all symbols |
| `GET` | `/api/assets/watchlist/file` | Export a versioned JSON file |
| `POST` | `/api/assets/watchlist/file` | Validate and import a JSON file |

### Search and Market Data

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/search` | Database search with filters and pagination |
| `GET` | `/api/assets/search` | Search available market symbols |
| `GET` | `/api/assets/candles` | Return OHLCV candle data |
| `GET` | `/api/assets/candles/meta` | Return candle cache metadata |
| `GET` | `/api/assets/performance` | Return multi-symbol performance |
| `GET` | `/api/ml/analyse` | Return ML trend analysis |

### Administrator API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/ping` | Verify administrator access |
| `GET` | `/api/admin/settings/finance-refresh-rate` | Read the refresh rate |
| `POST` | `/api/admin/settings/finance-refresh-rate` | Create or update the setting |
| `PUT` | `/api/admin/settings/finance-refresh-rate` | Replace the setting |
| `PATCH` | `/api/admin/settings/finance-refresh-rate` | Update the setting |
| `DELETE` | `/api/admin/settings/finance-refresh-rate` | Delete it and restore the default |

Administrator endpoints accept API keys but require the owning user to have the
`ADMIN` role. A regular user's valid API key receives `403 Forbidden`.

## Input Validation

Examples of server-side validation include:

- symbols are normalized and matched against a restricted pattern;
- watchlist arrays have a bounded maximum size;
- search queries and page sizes are bounded;
- chart ranges are limited to supported values;
- ML horizons accept only `1D`, `1W`, and `1M`;
- finance refresh rates accept only `60`, `300`, or `900` seconds;
- imported watchlist files require the expected MIME type, size, format, and
  version;
- malformed JSON returns a controlled client error.

Database queries use Prisma or parameterized tagged-template queries. User input
is not concatenated into SQL strings.

## Error Responses

API errors use a consistent JSON structure:

```json
{
  "error": "Description of the error."
}
```

Common response statuses are:

| Status | Meaning |
|---|---|
| `200` | Request completed |
| `201` | Resource or watchlist entry created |
| `400` | Invalid input |
| `401` | Missing or invalid authentication |
| `403` | Insufficient role |
| `404` | User or resource not found |
| `409` | Conflicting resource |
| `415` | Unsupported content type |
| `429` | Rate limit exceeded |
| `502` | Internal analysis service failed |
| `503` | Required service is unavailable |

## Web Documentation

Relevant files:

- `web/src/app/api-docs/page.tsx`
- `web/langages/en.json`
- `web/langages/fr.json`
- `web/langages/es.json`

The `/api-docs` page includes:

- supported authentication headers;
- the request limit;
- error behavior;
- every public API operation;
- required authorization level;
- request bodies;
- multipart upload examples;
- executable curl examples.

The documentation is available in English, French, and Spanish through the
application's language system.

## Automated Tests

The API test script covers:

- missing API key rejection;
- invalid API key rejection;
- watchlist `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`;
- watchlist file export and import;
- database and market search;
- candles and candle metadata;
- asset performance;
- ML analysis;
- administrator authorization;
- finance setting `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`;
- invalid request bodies;
- optional rate-limit verification.

Run it with:

```bash
API_KEY=ct_user_key \
ADMIN_API_KEY=ct_admin_key \
BASE_URL=https://localhost \
tests/api/public-api-tests.sh
```

To require the analysis-dependent endpoints to succeed:

```bash
STRICT_EXTERNAL=1 \
API_KEY=ct_user_key \
ADMIN_API_KEY=ct_admin_key \
BASE_URL=https://localhost \
tests/api/public-api-tests.sh
```

To verify that repeated requests eventually return `429`:

```bash
RUN_RATE_LIMIT_TEST=1 \
API_KEY=ct_user_key \
ADMIN_API_KEY=ct_admin_key \
BASE_URL=https://localhost \
tests/api/public-api-tests.sh
```

The test mutates the selected user's watchlist and the administrator finance
setting. It finishes by clearing the test watchlist and restoring the default
finance refresh rate.

## Evaluation Demonstration

A complete evaluator demonstration can follow these steps:

1. Sign in and open `/settings/api`.
2. Create an API key and show that the secret appears only once.
3. Call `GET /api/assets/watchlist` without a key and show `401`.
4. Call the same endpoint with the key and show `200`.
5. Demonstrate `POST`, `PUT`, and `DELETE` on the watchlist.
6. Open `/api-docs` and show the documented endpoints.
7. Use a regular key on `/api/admin/ping` and show `403`.
8. Use an administrator key and show `200`.
9. Run the rate-limit test and show `429` with rate-limit headers.
10. Delete the API key and show that it can no longer authenticate.

## Main Implementation Files

- `web/src/lib/api-auth.ts`
- `web/src/lib/rate-limit.ts`
- `web/src/lib/admin-auth.ts`
- `web/src/app/api/account/api-key/route.ts`
- `web/src/app/api/assets/watchlist/route.ts`
- `web/src/app/api/assets/watchlist/file/route.ts`
- `web/src/app/api/search/route.ts`
- `web/src/app/api/assets/search/route.ts`
- `web/src/app/api/assets/candles/route.ts`
- `web/src/app/api/assets/candles/meta/route.ts`
- `web/src/app/api/assets/performance/route.ts`
- `web/src/app/api/ml/analyse/route.ts`
- `web/src/app/api/admin/ping/route.ts`
- `web/src/app/api/admin/settings/finance-refresh-rate/route.ts`
- `web/src/app/api-docs/page.tsx`
- `web/prisma/schema.prisma`
- `tests/api/public-api-tests.sh`

## Conclusion

ClearTrend provides a documented public API with database interaction,
cryptographically generated API keys, hashed key storage, account ownership,
role-aware administration, server-side validation, rate limiting, and more than
the minimum required endpoint surface.

The implementation therefore satisfies the Secure Public API major module.
