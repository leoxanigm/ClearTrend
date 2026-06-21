# Advanced Search

## Status

- Type: Minor module
- Value: 1 point
- Status: Implemented
- Application page: `/search`
- API endpoint: `GET /api/search`

## Subject Requirements

The subject requires advanced search functionality with:

- filters;
- sorting;
- pagination.

ClearTrend provides a protected search page for database-backed assets and ML
analyses. Users can combine text search, entity type, sentiment, date range,
sort key, and sort direction. Results are paginated by the backend and rendered
as links to the corresponding dashboard asset.

## Requirements Mapping

| Requirement | ClearTrend implementation |
|---|---|
| Advanced search | Case-insensitive search across asset and analysis fields |
| Filters | Entity type, sentiment, start date, end date, and free-text query |
| Sorting | Creation date, name, or symbol |
| Sort direction | Ascending or descending |
| Pagination | Server-side `page` and `limit` using Prisma `skip` and `take` |
| Result count | A separate count query returns totals and page metadata |
| Protected access | Browser session or secured API key is required |
| Responsive interface | Search controls and results use the application design system |

## Architecture

```text
Authenticated user
      |
      | opens /search
      v
Next.js server page
      |
      | verifies browser session
      v
SearchClient
      |
      | GET /api/search?...filters
      v
Next.js search API
      |
      +-- authenticate and rate-limit
      +-- normalize query parameters
      +-- build Prisma filters and ordering
      +-- count matching rows
      +-- load one result page
      v
PostgreSQL
      |
      v
Normalized SearchResponse
      |
      v
Result cards and pagination controls
```

The browser does not construct database queries. It sends a bounded set of
query parameters, and the backend translates those parameters into Prisma
filters and ordering objects.

## User Flow

Relevant files:

- `web/src/app/search/page.tsx`
- `web/src/components/SearchClient.tsx`
- `web/src/components/DashboardClient.tsx`

The user opens Advanced Search from the application navigation. The `/search`
server page verifies that a user is signed in and redirects unauthenticated
users to `/login`.

From the search page, the user can:

1. enter a text query;
2. select assets or analyses;
3. choose a sort field;
4. choose ascending or descending order;
5. filter analyses by sentiment;
6. select a start and end date;
7. reset every filter;
8. move between result pages;
9. open a result in the dashboard.

Changing any search control resets the current page to page 1. This prevents a
previously valid high page number from producing an empty page after the result
set becomes smaller.

## Search Parameters

The API accepts the following query parameters:

| Parameter | Values | Default | Behavior |
|---|---|---|---|
| `q` | Text up to 80 characters | Empty | Case-insensitive partial matching |
| `type` | `assets`, `analyses` | `assets` | Selects the database entity group |
| `sort` | `createdAt`, `name`, `symbol` | `createdAt` | Selects the ordering field |
| `direction` | `asc`, `desc` | `desc` | Selects the ordering direction |
| `dateFrom` | `YYYY-MM-DD` | None | Includes records from the start of the day |
| `dateTo` | `YYYY-MM-DD` | None | Includes records through the end of the day |
| `sentiment` | `BULLISH`, `NEUTRAL`, `BEARISH` | None | Filters analysis trend labels |
| `page` | Positive integer | `1` | Selects the result page |
| `limit` | Positive integer, maximum 50 | `10` | Sets results per page |

Example request:

```http
GET /api/search?q=AAPL&type=analyses&sentiment=BULLISH&sort=createdAt&direction=desc&page=1&limit=10
```

Example using an API key:

```bash
curl \
  -H "Authorization: Bearer $CLEARTREND_API_KEY" \
  "https://localhost/api/search?q=AAPL&type=analyses&sentiment=BULLISH&sort=createdAt&direction=desc&page=1&limit=10"
```

## Asset Search

Relevant backend function:

- `searchAssets` in `web/src/app/api/search/route.ts`

Asset text search applies a case-insensitive partial match to:

- `symbol`;
- `name`.

Assets can be filtered by creation date and sorted by:

- creation date;
- symbol;
- name.

The response includes useful metadata such as the symbol and latest stored
price. Each result links to:

```text
/dashboard?symbol=<symbol>
```

## Analysis Search

Relevant backend function:

- `searchAnalyses` in `web/src/app/api/search/route.ts`

Analysis text search applies a case-insensitive partial match to:

- the analysis summary;
- the analysis horizon;
- the related asset symbol;
- the related asset name.

Analyses can also be filtered by:

- creation date;
- trend label: `BULLISH`, `NEUTRAL`, or `BEARISH`.

Analysis results include the related asset and expose normalized metadata:

- confidence score;
- emotion score;
- technical score;
- recommendation;
- trend label.

The Prisma query includes the related asset in the same operation, avoiding a
separate database request for every displayed result.

## Sorting

Relevant backend functions:

- `getAssetOrderBy`;
- `getAnalysisOrderBy`.

The interface exposes three sort keys:

| Sort key | Asset ordering | Analysis ordering |
|---|---|---|
| `createdAt` | Asset creation date | Analysis creation date |
| `name` | Asset name | Related asset name |
| `symbol` | Asset symbol | Related asset symbol |

Every key supports ascending and descending order. Unknown sort keys and
directions fall back to safe defaults rather than being inserted into a query.

## Pagination

Relevant files:

- `web/src/app/api/search/route.ts`
- `web/src/lib/search-types.ts`
- `web/src/components/SearchClient.tsx`

Pagination is performed in PostgreSQL through Prisma:

```text
skip = (page - 1) * limit
take = limit
```

The backend runs the count and result queries concurrently with
`Promise.all`. It returns:

- current page;
- page size;
- total matching records;
- total pages;
- whether a previous page exists;
- whether a next page exists.

The interface disables Previous and Next when navigation is unavailable or a
request is in progress.

## Request Lifecycle

The frontend builds one request URL from the complete controlled filter state.
A filter change automatically starts a new search.

Each request uses an `AbortController`. When the user changes another filter
before the current response finishes, the old request is cancelled. This
prevents an obsolete response from replacing newer results.

Search requests use `cache: 'no-store'`, ensuring that changing filters returns
the latest database state.

The implementation currently sends a request for each text-field change. The
previous request is cancelled, but the text input is not debounced. This does
not affect the module requirements and the API request limit still bounds
authenticated use.

## Input Normalization and Security

Relevant files:

- `web/src/app/api/search/route.ts`
- `web/src/lib/api-auth.ts`

The backend protects the query surface by:

- limiting text queries to 80 characters;
- accepting only known entity types;
- accepting only known sort keys;
- accepting only `asc` or `desc` directions;
- replacing invalid page values with page 1;
- using a default page size of 10;
- limiting page size to 50;
- converting date filters into bounded start/end timestamps;
- accepting only known analysis trend labels;
- constructing Prisma objects instead of concatenating SQL strings.

The endpoint calls `getApiUserProfile`, so requests require either a valid
browser session or API key. The shared API rate limiter also applies before the
search query reaches PostgreSQL.

## Response Contract

The shared response types are defined in:

- `web/src/lib/search-types.ts`

The response has three sections:

```json
{
  "filters": {
    "q": "AAPL",
    "type": "assets",
    "sort": "createdAt",
    "direction": "desc",
    "page": 1,
    "limit": 10,
    "dateFrom": null,
    "dateTo": null,
    "sentiment": null,
    "source": null
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  },
  "results": []
}
```

Assets and analyses are converted into one `SearchResultItem` shape. This lets
the UI render both entity types through the same result component while keeping
entity-specific values in `metadata`.

## Interface States

The page provides dedicated states for:

- loading;
- request failure;
- no results;
- singular and plural result counts;
- current page and total pages;
- unavailable previous or next pages.

Results are displayed as reusable cards. Navigable results use links, so users
retain normal browser behaviors such as opening a result in another tab.

## Internationalization

Relevant translation namespaces:

- `searchPage` in `web/langages/en.json`;
- `searchPage` in `web/langages/fr.json`;
- `searchPage` in `web/langages/es.json`.

Search labels, entity names, sort options, directions, sentiment values,
buttons, result states, pagination text, and errors are translated into English,
French, and Spanish.

## Testing

The public API test script exercises the authenticated search endpoint:

```bash
API_KEY=ct_user_key \
ADMIN_API_KEY=ct_admin_key \
BASE_URL=https://localhost \
tests/api/public-api-tests.sh
```

A focused manual check can use:

```bash
curl \
  -H "Authorization: Bearer $CLEARTREND_API_KEY" \
  "https://localhost/api/search?q=AAPL&type=assets&sort=symbol&direction=asc&page=1&limit=10"
```

Recommended manual checks:

1. Search assets by partial symbol.
2. Search assets by partial name.
3. Switch from assets to analyses.
4. Filter analyses by each sentiment.
5. Apply start and end dates.
6. Sort by date, name, and symbol in both directions.
7. Navigate forward and backward through multiple pages.
8. Reset all filters and verify that the page returns to page 1.
9. Open a result and verify that the dashboard selects its asset.
10. Repeat a request without authentication and verify `401 Unauthorized`.

## Evaluation Demonstration

An evaluator demonstration can follow these steps:

1. Sign in and open `/search` from Advanced Search.
2. Enter a partial asset symbol and show matching database results.
3. Change the entity type to analyses.
4. Apply a sentiment and date range filter.
5. Change the sort key and direction.
6. Navigate between result pages.
7. Open an analysis result in the dashboard.
8. Show the `/api/search` response and its pagination metadata.
9. Explain the Prisma `count`, `skip`, `take`, filters, and ordering.
10. Show that invalid enum values fall back safely and page size is capped.

## Main Implementation Files

- `web/src/app/search/page.tsx`
- `web/src/components/SearchClient.tsx`
- `web/src/app/api/search/route.ts`
- `web/src/lib/search-types.ts`
- `web/src/lib/api-auth.ts`
- `web/src/lib/prisma.ts`
- `web/src/components/ui/TextInput.tsx`
- `web/src/components/ui/SelectField.tsx`
- `web/src/components/ui/Button.tsx`
- `web/langages/en.json`
- `web/langages/fr.json`
- `web/langages/es.json`
- `tests/api/public-api-tests.sh`

## Current Scope

The implemented entity types are assets and analyses. The API response contains
a reserved `source` field, but source filtering is not exposed in the interface
and is not applied to the current database query. It is therefore not claimed
as part of the module.

This scope still exceeds the subject requirement because the module provides
multiple functional filters, configurable sorting, and complete server-side
pagination over two related database entity types.

## Conclusion

ClearTrend implements advanced search as a complete user workflow rather than a
single text field. Search combines multiple filters, database-backed sorting,
bounded server-side pagination, normalized heterogeneous results, protected API
access, request cancellation, and translated interface states.

The implementation therefore satisfies the Advanced Search minor module.
