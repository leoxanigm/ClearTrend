*This project has been created as part of the 42 curriculum by amoureau, elhirond, mathboye and zalemu*

# Description

Transcendence is a web application base for a financial analysis dashboard.

Current starter scope:

- Next.js web application with React and TypeScript.
- FastAPI analysis service for market data and future analysis helpers.
- PostgreSQL database managed from the web service with Prisma.
- Docker Compose setup for development and evaluation-like HTTPS mode.
- Automated PostgreSQL backups and tested recovery commands through Docker.

# Instructions

Prerequisites:

- Docker with Docker Compose.
- Make.
- OpenSSL for local certificate generation.

Start the development environment:

```sh
make dev
```

Development mode starts `web`, `analysis`, `db`, and the automated backup
service with hot reload and plain HTTP:

- Web: http://localhost:3000
- Web health: http://localhost:3000/api/health
- Public status page: http://localhost:3000/status
- Analysis health: http://localhost:8000/health

Start the evaluation-like environment:

```sh
make up
```

Evaluation-like mode builds the containers and exposes the app through nginx with HTTPS:

- HTTPS app: https://localhost

Useful commands:

```sh
make logs
make ps
make health
make db-shell
make reset-db
make backup
make restore-check file=backups/name.sql
make restore file=backups/name.sql
make down
make fclean
```

The first run copies `.env.example` to `.env`. Local secrets and generated certificates are ignored by Git.

If PostgreSQL authentication fails after pulling new Docker or environment changes, run:

```sh
make reset-db
```

This deletes only the local PostgreSQL Docker volume and recreates it from `.env`.

# Resources


# Team Information


# Project Management


# Technical Stack

- Web: Next.js, React, TypeScript, Tailwind CSS.
- Database ORM: Prisma.
- Analysis service: Python, FastAPI.
- Database: PostgreSQL 17 Alpine.
- HTTPS proxy: nginx.
- Containers: Docker Compose.

# Database Schema


# Features List


# Modules

| Module | Type | Status | Valid points | Participants |
|---|---:|---|---:|---|
| Frontend and Backend Frameworks | Major | Valid | 2 | elhirond, amoureau, mathboye |
| Backend Microservices | Major | Valid | 2 | elhirond, mathboye, amoureau |
| Advanced Analytics Dashboard with Data Visualization | Major | Valid | 2 | elhirond, mathboye |
| Real-time WebSocket/SSE | Major | Not implemented | 0 | |
| ML Trend Prediction (custom) | Major | Implemented, live Gemini test pending | 0 | mathboye, elhirond |
| Secure Public API | Major | Partial, not validated | 0 | zalemu |
| Advanced Permissions | Major | Partial, not validated | 0 | amoureau |
| Additional Browsers | Minor | Valid | 1 | elhirond |
| Custom Design System | Minor | Valid | 1 | elhirond, amoureau |
| ORM | Minor | Valid | 1 | elhirond, amoureau, zalemu |
| Advanced Search | Minor | Partial, not validated | 0 | zalemu |
| Health, Status, Backups, DR | Minor | Valid | 1 | elhirond, mathboye, zalemu |
| OAuth 2.0 | Minor | Valid | 1 | amoureau |
| Notifications CRUD | Minor | Not implemented | 0 | amoureau |
| 3 Languages | Minor | Valid | 1 | elhirond |
| File Upload Management | Minor | Valid | 1 | elhirond |
| **Total defendable now** |  |  | **13** | |

Participants are inferred from non-merge commits with a functional link to the
module, not every incidental file touch. Aliases are normalized: `leoxanigm` is
counted as `zalemu`, and `mbcraft-exe` / `Mathys` as `mathboye`.

## Major Modules

### Major - Frontend and Backend Frameworks

The project uses modern frameworks for both the user interface and the server side.

Proofs:

- Frontend: Next.js with React and TypeScript for pages and UI components.
- Backend: Next.js API routes for authentication, user data, public API, and health checks.
- Backend: FastAPI service for market data endpoints used by the web application.

### Major - Backend Microservices

The backend is split into independent services with clear responsibilities and internal REST communication.

Proofs:

The `web` service is the application backend: authentication, user profile, watchlist, admin settings, public API routes, and database writes through Prisma.

The `analysis` service is a separate FastAPI backend: market data cache warmup, scheduled refresh, ticker list, snapshots, performances, candles, and health endpoint.

Communication between services uses REST over the Docker network with `ANALYSIS_URL=http://analysis:8000`. The web backend validates user input, calls the analysis backend server-side, normalizes the response, and exposes protected API routes to the frontend.

Docker Compose runs `web`, `analysis`, `db`, and `proxy` as separate services with healthchecks. The global `/api/health` endpoint reports the status of the web backend, database, and analysis backend.

### Major - Advanced Analytics Dashboard with Data Visualization

Status: valid.

The dashboard provides interactive market visualizations connected to the FastAPI analysis service.

Proofs:

- SVG price line and OHLC candlestick chart using each interval's real open, high, low, and close values.
- Interactive hover details, axes, provider, interval, point count, latest market candle, and cache update metadata.
- Asset filter, ranges `1D` to `1Y`, and custom start/end filtering inside the loaded period.
- Automatic refresh from the analysis cache, including refresh when the browser tab becomes visible again.
- CSV and JSON export for the selected asset and range, including OHLCV candles and candle variation.
- Loading, unavailable-data, and empty-filter states.

The Trend and Sentiment tiles are placeholders reserved for the future ML module. They are not used as proof for this analytics module.

Detailed operation and tests: `docs/modules/advanced_analytics_dashboard.md`.

### Major - Real-time WebSocket/SSE

Status: not implemented yet, not validated.

The application currently has periodic dashboard refreshes, but it does not yet implement a real-time WebSocket or SSE channel. Chart data is refreshed by client polling, and UI notifications are local to the current browser session.

Current progress:

- Dashboard chart polling refreshes market data from the analysis cache.
- The notification UI can display local toasts through `NotificationProvider`.
- The data model already contains notification-related tables for future work.

Still missing before validation:

- A real `/api/events` endpoint using `text/event-stream` or a WebSocket endpoint.
- A client `EventSource` or WebSocket hook with reconnect handling.
- Server-side broadcast events such as `notification.created`, `analysis.updated`, and `watchlist.updated`.
- Cross-tab or cross-client demo proving that one backend event updates another connected client without manual refresh.

### Major - ML Trend Prediction (custom module)

Status: implemented, live Gemini test pending before validation.

ClearTrend combines historical market data, recent Reddit sentiment, and
ApeWisdom attention to estimate a bearish, neutral, or bullish trend over one
day, one week, and one month.

Why this custom module:

- It is directly relevant to a stock and cryptocurrency analytics platform.
- It addresses temporal ML validation, multi-source normalization, external API
  failures, uncertainty, and explainability.
- It adds estimated prices, trend scores, confidence, and social sentiment to
  the dashboard.
- It deserves Major status because it contains four coordinated analysis
  methods, chronological backtesting, three prediction horizons, a FastAPI API,
  and a frontend integration.

Proof:

- Ridge Regression estimates future log returns from five years of OHLCV data.
- Time-series cross-validation prevents future data from leaking into training.
- Each asset and horizon is trained independently; no universal model mixes
  Bitcoin, equities, indices, and gold histories.
- Reddit RSS supplies short posts from the latest seven days; Gemini classifies
  their investment sentiment.
- ApeWisdom measures how much attention the asset receives and adjusts the
  importance of the social signal without treating popularity as bullish.
- The final score is normalized between `0` and `1`; confidence stays low when
  backtests are weak, sources are missing, or signals disagree.
- A backend daily job retrains after market-data refresh and writes one atomic
  snapshot per asset to the shared analysis volume.
- Dashboard and API requests only read these shared snapshots; user refreshes
  never start model training or external social calls.

Supported assets: S&P 500, Nasdaq Composite, Bitcoin, Ethereum, gold, Alphabet,
and Nvidia.

The complete design, formulas, variables, endpoints, tests, and limitations are
documented in `docs/modules/ml_trend_prediction.md`.

Still missing before claiming the two points:

- Configure `GEMINI_API_KEY` locally.
- Run and inspect at least one real social analysis.
- Demonstrate the three horizons and explain why confidence can remain low.

### Major - Secure Public API

Status: partially implemented, not validated yet.

The project already has the foundations for external API access: users can
create an API key, the secret is displayed once, only the hash is stored, and
several backend routes accept either a browser session or an API key.

Current progress:

- API keys are stored in PostgreSQL with a hash, prefix, creation date, last use
  date, and revocation field.
- Account settings can create, display metadata for, and delete an API key.
- API authentication accepts `Authorization: Bearer <api_key>` and
  `X-API-Key: <api_key>`.
- API-key requests update `lastUsedAt`.
- Authenticated endpoints already exist for watchlist CRUD, asset candles,
  asset search, asset performance, and advanced search.
- `/api-docs` lists curl examples for the current API routes.

Still missing before validation:

- Add a clear public/versioned namespace, for example `/api/public/v1`.
- Add API-key rate limiting on the public endpoints, not only on login/register.
- Provide at least five public endpoints covering the expected resource surface,
  including assets, watchlists, reports, and notifications.
- Add a machine-readable API contract such as `/api/public/v1/openapi.json`.
- Standardize public API errors and document `401`, `403`, `404`, `409`, `429`,
  and `5xx` responses.
- Validate the full curl flow with a generated key, including unauthorized and
  rate-limited requests.

### Major - Advanced Permissions

Status: partially implemented, not validated yet.

The project has a real admin foundation: roles exist in the database, admin-only
screens are protected server-side, and admins can inspect users and ban/unban
accounts. This is a good start, but it is not yet the complete "Advanced
permissions" module.

Current progress:

- Prisma defines `USER`, `ADMIN`, and `ANALYST` roles.
- Users have a `role` and optional `bannedAt` field.
- `/admin` is only accessible to admins.
- Admin API routes use a server-side `requireAdminUser` guard.
- The admin page lists users, supports search/sort, displays role/status/API key
  count/watchlist metadata, and can ban or unban users.
- Banned users are blocked from profile reads and sign-in/session refresh flows.

Still missing before validation:

- Full user CRUD from the admin interface.
- Admin action to change a user's role.
- Reusable `requireRole` or policy helpers for more than admin-only checks.
- A real `ANALYST` permission surface, because the role exists but is not used
  for specific views/actions yet.
- A short manual validation scenario proving user/admin/analyst behavior.

## Minor Modules

### Minor - Additional Browsers

The main interface was manually checked on Chrome, Firefox, and Edge.

Proofs:

- Chrome: login, dashboard, watchlist, charts, profile, theme, and languages display correctly.
- Firefox: same user flows display correctly.
- Edge: same user flows display correctly.

### Minor - Custom Design System

The interface uses a small custom UI library with shared tokens and generic reusable components.

Proofs:

The component library can be checked visually on `/ui-showcase`. This page is not linked in the product navigation and is meant to be opened only by direct URL.

15 Reusable components:

- Button, IconButton, TextInput, SelectField, SegmentedControl.
- Badge, Card, MetricTile, Avatar, DropdownMenu.
- Modal, Tooltip, Toast, ThemeSwitch, NotificationProvider.

The design system also centralizes light/dark tokens, surfaces, borders, text colors, accent colors, and shared UI CSS. App screens reuse these primitives on login, dashboard, profile settings, menus, charts, and admin forms, with UI assets such as logo variants, OAuth icons, theme icons, and favorite icons.

### Minor - ORM

The web backend uses Prisma as the ORM layer for the PostgreSQL database.

Proofs:

Prisma defines the relational schema for users, assets, watchlists, analyses, reports, notifications, API keys, app settings, and user events. The schema includes relations, enums, unique constraints, indexes, and SQL table mappings.

The generated Prisma client is used by the application backend for authentication, OAuth user upsert, profile management, API keys, admin user management, advanced search, watchlist persistence, app settings, and health checks.

Validation:

- `npx prisma validate` passes. It checks that `schema.prisma` is syntactically valid and that models, relations, enums, and datasource settings are coherent.
- `npm run prisma:generate` generates the Prisma client successfully. It creates the TypeScript client used by the backend to query PostgreSQL through Prisma.

### Minor - Advanced Search

Status: partially implemented, not validated yet.

The project has two search surfaces. The quick watchlist search is functional for
asset lookup. The dedicated `/search` interface also exists and calls the
backend, but the module is not validated yet because the searchable database
content is not reliably populated by the current user flows.

Current progress:

- Watchlist asset search uses `/api/assets/search`.
- The "Advanced Search" button opens the protected `/search` page.
- The `/search` page calls `/api/search` with filters, sorting, direction,
  pagination, date range, sentiment, and source parameters.
- `/api/search` uses Prisma to search assets, analyses, reports, and
  notifications.

Still missing before validation:

- Seed or generate useful demo data for every searched type.
- Ensure the dashboard, watchlist, and analysis flows create searchable records
  in the database.
- Validate the full flow from the Advanced Search button to real results.
- Document a demo proving filters, sorting, pagination, and multiple result
  types.

### Minor - Health, Status, Backups, DR

Status: implemented and runtime validated.

ClearTrend exposes live service health, a public status page, automated database
backups, and tested PostgreSQL recovery tooling.

Detailed module documentation:
[Health, Status, Backups and DR](docs/modules/health_status_backups_dr.md).

Proof:

- `/api/health` exists in the web backend and checks the web app, PostgreSQL
  through Prisma, and the FastAPI analysis service. It returns `503` when a
  dependency is unavailable.
- `/api/health/live` is the independent web liveness probe used by Docker.
- `/status` is public and refreshes the service state every 15 seconds.
- Docker Compose healthchecks cover `web`, `analysis`, and `db`.
- The `backup` service creates a PostgreSQL dump at startup and every 24 hours
  by default, with seven-day retention. Both values are configurable in `.env`.
- `make backup` creates an immediate timestamped dump in `backups/`.
- `make restore-check file=backups/name.sql` restores into an isolated temporary
  database and verifies the result without touching development data.
- `make restore file=backups/name.sql` performs the disaster recovery restore
  after stopping the application services. It replaces the current database.

The backup and isolated restore were tested on June 7, 2026: 11 public tables
were restored successfully. The degraded scenario was also tested: stopping the
analysis service keeps `/status` available while `/api/health` returns `503`,
then returns to `200` after recovery.

Disaster recovery procedure:

1. Choose the latest valid file in `backups/`.
2. Run `make restore-check file=backups/name.sql`.
3. Run `make restore file=backups/name.sql`.
4. Run `make health` and open `/status`.

With the default daily schedule, the target RPO is at most 24 hours. For this
project-sized database, the expected RTO is a few minutes.

### Minor - OAuth 2.0

Status: implemented and manually validated.

The application uses NextAuth for remote authentication and exposes OAuth sign-in
buttons directly on the login page.

Current progress:

- OAuth providers are configured for Google, GitHub, and 42 School.
- The login page displays only providers that are configured in the current
  environment.
- OAuth users are stored in the Prisma `User` model with provider name and
  provider account id.
- The sign-in callback creates or updates the user, stores the display name, and
  keeps the OAuth avatar when available.
- The session and JWT callbacks expose the internal user id and OAuth identity.
- `.env.example` lists client id/client secret variables for Google, GitHub, and
  42 School.
- OAuth accounts are intentionally keyed by provider and provider account id.
  They are not automatically linked to an existing email/password account with
  the same email.

Validation:

- Google OAuth works for account creation and login.
- GitHub OAuth works for account creation and login.
- 42 School OAuth works for account creation and login.

Setup notes:

- Generate `AUTH_SECRET` with `openssl rand -base64 32`.
- Configure only the OAuth providers you want to expose; missing or placeholder
  credentials are ignored by NextAuth and hidden on the login page.

### Minor - Notifications CRUD

Status: not implemented yet, not validated.

The project has the data model and local toast UI needed to support
notifications, but it does not yet provide a complete persistent notification
system.

Current foundation:

- Prisma contains a `Notification` model with type, title, body, entity
  metadata, read date, and timestamps.
- The `NotificationType` enum already covers watchlist, analysis, API key,
  export, and system events.
- The advanced search endpoint can read existing notifications.
- The UI has a local `NotificationProvider` and toast component for immediate
  browser feedback, already used for profile updates, logout, account deletion,
  and related success/error states.

Still missing before validation:

- Add `/api/notifications` CRUD endpoints.
- Add list, mark as read/unread, update, and delete behavior.
- Create persistent notifications automatically from key actions such as
  watchlist changes, analysis/report events, API key creation/revocation, and
  imports/exports.
- Add a notification center in the dashboard.
- Validate the flow with real persisted notifications, not only local toasts.

### Minor - 3 Languages

Status: implemented and valid.

The application supports English, French, and Spanish through `next-intl`.

Proofs:

- Translation files exist for `en`, `fr`, and `es`.
- The three translation files expose the same 250 message keys.
- The active locale is resolved from the `cleartrend-locale` cookie or the
  browser `Accept-Language` header.
- The root layout sets the HTML `lang` attribute from the active locale.
- A language selector is available on login and from the dashboard user menu.
- Main product screens use translated messages: login, dashboard, watchlist,
  chart, profile settings, advanced search, API docs, API key page, admin page,
  legal pages, theme switch, OAuth buttons, and footer links.

Validation:

- English, French, and Spanish can be selected from the UI.
- The app refreshes after changing language and keeps the choice in a cookie.
- Translation key parity was checked: no missing keys between `en`, `fr`, and
  `es`.

### Minor - File Upload Management

Status: implemented and validated.

ClearTrend supports two controlled file workflows: private avatar images and
versioned JSON watchlist import/export.

Detailed module documentation:
[File Upload Management](docs/modules/file_upload_management.md).

Proof:

- JPEG, PNG, and WebP avatars are validated on both client and server.
- Sharp decodes, rotates, resizes, strips metadata, and converts images to WebP.
- Avatar upload keeps the manual zoom and position editor.
- New avatars are stored outside `public/` in a persistent Docker volume and
  served only to their authenticated owner.
- Upload progress, preview, replacement, removal, and account cleanup are
  implemented.
- Favorite symbols can be exported to a versioned JSON file.
- JSON import validates MIME, extension, size, structure, version, symbols, and
  known analysis tickers before merging favorites.
- The UI previews imported symbols and displays upload progress.
- `make test-file-upload` runs the image pipeline, authenticated avatar API, and
  watchlist JSON integration tests.


# Individual Contributions

## amoureau

## elhirond

## mathboye

## zalemu

(rough bullet points to remember. edit and explain later)
* Prisma ORM for tables
* Advanced search
* public API
