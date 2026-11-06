*This project has been created as part of the 42 curriculum by amoureau, elhirond, mathboye and zalemu*

# Description

ClearTrend is a web application base for a financial analysis dashboard.

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
- `.env` based on `.env.example` with secrets and keys replaced with their
  appropriate values.

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


# Team Information

## Roles

| Role | Student |
| --- | --- |
| Product Owner, Project Manager | elhirond |
| Technical Lead | zalemu |
| Developers | amoureau, mathboye |

While the team members had a clearly assigned roles, each team member
contributed code for multiple modules in the project.

### PO, MP

* Project idea and features
* Team meeting organization and leading
* Deadline tracking and progress verification

### Technical lead

* Outline of best development practices, Eg:
  - Branch naming
  - Commit naming
* Review of pull request
* Code reorganization

### Developers

* Implementing features based on selected modules
* Fixing bugs
* Documentation


# Project Management

The team had its first meeting at school to decide on the project idea
and core features. In the first meeting we decided on:
  * Product idea and name
  * Meeting frequency and schedule (One a week on Tuesdays)
  * Meetings at school for important decisions
  * Meetings on Discord for progress review

We extensively used GitHub for code and issue management.

We used Discord for communication.

# Technical Stack

- Web: Next.js, React, TypeScript, Tailwind CSS.
- Database ORM: Prisma.
- Analysis service: Python, FastAPI, LLM API requests.
- Database: PostgreSQL 17 Alpine.
- HTTPS proxy: nginx.
- Containers: Docker Compose.

# Database Schema

The application stores its persistent web data in PostgreSQL. The schema is
defined with `prisma` in `web/prisma/schema.prisma`, and the generated `prisma`
client is used by the Next.js backend routes.

Main tables:

| Table | Purpose |
|---|---|
| `users` | User accounts, OAuth identity fields, profile data, roles, bans, and favorites |
| `assets` | Market assets searchable in the dashboard and public API |
| `watchlists` | User-owned watchlist groups |
| `watchlist_items` | Many-to-many relation between watchlists and assets |
| `analyses` | Stored analysis requests, status, trend, recommendation, scores, and summaries |
| `analysis_sources` | Source material attached to an analysis, such as prices, comments, news, API data, or scraped data |
| `notifications` | Persistent user notifications for creation, update, deletion, and system events |
| `api_keys` | Hashed public API keys, prefixes, revocation state, and last-use timestamps |
| `user_events` | Auditable user activity such as login, search, asset views, exports, and watchlist actions |
| `app_settings` | Key-value application settings used by admin/backend features |

Important relations:

- Deleting a user cascades to their analyses, watchlists, notifications, API keys,
  events, and reports.
- Deleting an asset cascades to related watchlist items and analyses.
- `watchlist_items` enforces one asset per watchlist with a unique
  `(watchlistId, assetId)` constraint.
- `users` enforces unique emails and unique OAuth provider accounts.
- `api_keys` stores only hashed keys and enforces one API key per user.

The schema uses indexes on frequent access paths such as user ownership,
asset symbols, analysis status, notification state, API key prefix, event type,
and creation dates.

For more ORM documentation and visual representation, please check:
[ORM minor module](docs/modules/en/orm.md).

# Features List


# Modules

| Module | Type | Status | Valid points | Participants |
|---|---:|---|---:|---|
| Frontend and Backend Frameworks | Major | Valid | 2 | elhirond, amoureau, mathboye, zalemu |
| Backend Microservices | Major | Valid | 2 | elhirond, mathboye, amoureau, zalemu |
| Advanced Analytics Dashboard with Data Visualization | Major | Valid | 2 | elhirond, mathboye |
| ML Trend Prediction (custom) | Major | Implemented, full live social cycle pending | 0 | mathboye, elhirond |
| Secure Public API | Major | Valid | 2 | zalemu |
| Advanced Permissions | Major | Valid | 2 | amoureau |
| Additional Browsers | Minor | Valid | 1 | elhirond |
| Custom Design System | Minor | Valid | 1 | elhirond |
| ORM | Minor | Valid | 1 | mathboye |
| Advanced Search | Minor | Valid | 1 | zalemu |
| Health, Status, Backups, DR | Minor | Valid | 1 | mathboye |
| OAuth 2.0 | Minor | Valid | 1 | amoureau |
| Complete Notification System | Minor | Valid | 1 | amoureau |
| 3 Languages | Minor | Valid | 1 | elhirond |
| File Upload Management | Minor | Valid | 1 | elhirond |
| **Total defendable** |  |  | **19** | |

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

The `analysis` service is a separate FastAPI backend: market data cache warmup, scheduled refresh, ticker list, snapshots, performances, candles, and health endpoint.  It also performs an analysis through LLM model by scrapping specialized threads and analysing the emitted sentiments on the stocks.

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

The Trend and Sentiment tiles are supplied by the separate ML & LLM module. They enrich
the page but are not used as proof for this analytics module.

Detailed architecture, operation, limitations, and tests:
[Advanced Analytics Dashboard](docs/modules/en/advanced_analytics_dashboard.md).

### Major - ML Trend Prediction (custom module)

Status: implemented, full live social cycle pending before validation.

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
- Reddit RSS supplies short posts from the latest seven days; Gemma classifies
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
documented in `docs/modules/en/ml_trend_prediction.md`.

Still missing before claiming the two points:

- Configure `QWEN_API_KEY` locally.
- Run and inspect a complete daily social-analysis cycle once quota is
  available.
- Demonstrate the three horizons and explain why confidence can remain low.

### Major - Secure Public API

Status: valid.

ClearTrend exposes documented authenticated API routes that can be used by
external clients. Users can create an API key, the secret is displayed once,
only its SHA-256 hash is stored, and protected routes accept either a browser
session or an API key.

Proof:

- API keys are stored in PostgreSQL with a hash, prefix, creation date, last use
  date, and revocation field.
- Account settings can create, display metadata for, and delete an API key.
- API authentication accepts `Authorization: Bearer <api_key>` and
  `X-API-Key: <api_key>`.
- API-key requests update `lastUsedAt` and pass through the shared API rate
  limiter.
- Authenticated endpoints cover watchlist `GET`, `POST`, `PUT`, `PATCH`, and
  `DELETE`, plus asset candles, asset search, asset performance, ML analysis,
  advanced search, and administrator finance settings.
- `/api-docs` lists curl examples for the current API routes.

Detailed architecture, endpoints, validation, rate limiting, tests, and
limitations:
[Secure Public API](docs/modules/en/secure_public_api.md).

### Major - Advanced Permissions

Status: valid.

ClearTrend implements role-based access with separate `USER`, `ANALYST`, and
`ADMIN` surfaces. Admin-only screens and API routes are protected server-side,
analysts have a dedicated read-only analysis view, and administrators can manage
users, roles, bans, and account deletion from the admin interface.

Proof:

- Prisma defines `USER`, `ADMIN`, and `ANALYST` roles.
- Users have a `role` and optional `bannedAt` field.
- `/admin` is only accessible to admins.
- `/analyst` is accessible to admins and analysts, but not regular users.
- Admin API routes use a server-side `requireAdminUser` guard, while analyst
  access uses the generic `requireRole` helper.
- The admin page lists users, supports search/sort, displays role/status/API key
  count/watchlist metadata, updates profile fields, changes roles, bans/unbans
  users, and deletes accounts.
- Role changes and admin deletion protect against removing the last admin.
- Banned users are blocked from sign-in and profile/session refresh flows.

Detailed behavior, files, validation flow, and limits:
[Advanced Permissions](docs/modules/en/advanced_permissions.md).

## Minor Modules

### Minor - Additional Browsers

The main interface was manually checked on Chrome, Firefox, and Edge.

Proofs:

- Chrome: login, dashboard, watchlist, charts, profile, theme, and languages display correctly.
- Firefox: same user flows display correctly.
- Edge: same user flows display correctly.

Validation scope and known limitations:
[Additional Browsers](docs/modules/en/additional_browsers.md).

### Minor - Custom Design System

The interface uses a small custom UI library with shared tokens and generic reusable components.

Proofs:

The component library can be checked visually on `/ui-showcase`. This page is not linked in the product navigation and is meant to be opened only by direct URL.

15 reusable generic components and services:

- Button, IconButton, TextInput, SelectField, SegmentedControl.
- Badge, Card, MetricTile, Avatar, DropdownMenu.
- Modal, Tooltip, Toast, ThemeSwitch, NotificationProvider.

`LanguageSelect` is an additional application-level composition built from
`SelectField`. The design system also centralizes light/dark tokens, surfaces,
borders, text colors, accent colors, and shared UI CSS. App screens reuse these
primitives on login, dashboard, profile settings, menus, charts, and admin
forms, with UI assets such as logo variants, OAuth icons, theme icons, and
favorite icons.

Architecture, component inventory, and limitations:
[Custom Design System](docs/modules/en/custom_design_system.md).

### Minor - ORM

The web backend uses Prisma as the ORM layer for the PostgreSQL database.

Proofs:

Prisma defines the relational schema for users, assets, watchlists, analyses, reports, notifications, API keys, app settings, and user events. The schema includes relations, enums, unique constraints, indexes, and SQL table mappings.

The generated Prisma client is used by the application backend for authentication, OAuth user upsert, profile management, API keys, admin user management, advanced search, watchlist persistence, app settings, and health checks.

Validation:

- `npx prisma validate` passes. It checks that `schema.prisma` is syntactically valid and that models, relations, enums, and datasource settings are coherent.
- `npm run prisma:generate` generates the Prisma client successfully. It creates the TypeScript client used by the backend to query PostgreSQL through Prisma.

More on ORM module: 
[ORM minor module](docs/modules/en/orm.md).

### Minor - Advanced Search

Status: valid.

ClearTrend provides a protected `/search` page backed by `GET /api/search`.
Users can combine text search, entity type, sentiment, date range, sort key,
sort direction, page, and page size. The backend normalizes the query and uses
Prisma filters, ordering, count, `skip`, and `take` for database-backed
pagination.

Proof:

- Watchlist asset search uses `/api/assets/search`.
- The "Advanced Search" button opens the protected `/search` page.
- The `/search` page calls `/api/search` with filters, sorting, direction,
  pagination, date range, and sentiment.
- `/api/search` uses Prisma to search assets and analyses, then returns
  normalized result cards and pagination metadata.
- Browser sessions and API keys are both supported.

Detailed implementation, response contract, security, testing, and demo flow:
[Advanced Search](docs/modules/en/advanced_search.md).

### Minor - Health, Status, Backups, DR

Status: implemented and runtime validated.

ClearTrend exposes live service health, a public status page, automated database
backups, and tested PostgreSQL recovery tooling.

Detailed module documentation:
[Health, Status, Backups and DR](docs/modules/en/health_status_backups_dr.md).

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

### Minor - Complete Notification System

Status: implemented.

ClearTrend has a centralized notification provider for creation, update, and
deletion actions. A feature component calls `notify(...)`; the UI displays a
toast immediately, and authenticated users also persist the same event through
`POST /api/notifications`.

Proof:

- Prisma contains a `Notification` model with type, title, body, entity
  metadata, read date, and timestamps.
- The `NotificationType` enum covers watchlist, analysis, API key, export, and
  system events.
- `NotificationProvider` exposes `notify(...)` and
  `notifyAfterNavigation(...)`.
- The server endpoint validates the session, normalizes fields, truncates text
  values, and creates the notification row for the current user.
- Toast display remains best effort: UI feedback is not blocked by a failed
  persistence request.

Detailed behavior, endpoint contract, classification rules, and manual
validation:
[Complete Notification System](docs/modules/en/database_notifications.md).

### Minor - 3 Languages

Status: implemented and valid.

The application supports English, French, and Spanish through `next-intl`.

Proofs:

- Translation files exist for `en`, `fr`, and `es`.
- The three translation files expose the same 442 message keys.
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

Architecture, coverage, validation, and limitations:
[3 Languages](docs/modules/en/three_languages.md).

### Minor - File Upload Management

Status: implemented and validated.

ClearTrend supports two controlled file workflows: private avatar images and
versioned JSON watchlist import/export.

Detailed module documentation:
[File Upload Management](docs/modules/en/file_upload_management.md).

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


# Future Work

## Real-time WebSocket/SSE

Real-time WebSocket/SSE is not claimed as a validated module. The dashboard
currently refreshes market data by polling the analysis cache, and UI
notifications are displayed locally in the current browser session.

A future implementation could add:

- `/api/events` using `text/event-stream`, or a WebSocket endpoint;
- a client `EventSource` or WebSocket hook with reconnect handling;
- server-side events such as `notification.created`, `analysis.updated`, and
  `watchlist.updated`;
- a cross-tab or cross-client demo proving that one backend event updates
  another connected client without manual refresh.


# Individual Contributions

## amoureau

- Built the first PostgreSQL-backed user account flow, including the basic
  `User` Prisma model, Prisma client wiring, and the registration API route.
- Migrated authentication from custom session routes to NextAuth/Auth.js and
  kept the existing login, register, privacy, terms, and dashboard flows working
  with the new session model.
- Implemented OAuth 2.0 sign-in for Google, GitHub, and 42 School, including
  provider configuration, login buttons, provider icons, environment variables,
  and the NextAuth callback route.
- Linked OAuth accounts to database users with provider-specific identifiers,
  then fixed the account-linking bug that could otherwise merge different OAuth
  accounts through the same email address.
- Added login and registration rate limiting, plus the shared rate-limit helper
  used to protect authentication attempts.
- Added role-aware profile/session data and server-side admin authorization
  helpers, including `requireAdminUser`.
- Built the administrator area in several steps: basic admin panel, refined
  admin page, role badges, role changes, user deletion, ban-aware access,
  analyst page access, and the ability to manage users from `/admin`.
- Linked the administrator finance refresh-rate setting to the analysis service
  and dashboard refresh behavior through persisted app settings and an admin API route.
- Added account deletion support, including the authenticated delete-account API
  route and dashboard/profile UI entry points.
- Built the notification system: reusable toast provider, global provider
  mounting, profile/login/logout/register notifications, navigation-delayed
  notifications, and notification styling.
- Added database persistence for notifications through
  `POST /api/notifications`, then added the administrator notification viewer
  with search, sort, user metadata, entity metadata, and translated labels.


## elhirond

## mathboye

## zalemu

zalemu served as technical lead and developer. Additionally, he mainly worked on the backend-facing features around public access,
search, API authentication, and database-backed request handling.

He implemented the Secure Public API module, API key creation and revocation,
hashed API key authentication, and the advanced search endpoint for assets and
analyses. He also connected the search UI to the backend route, added Prisma
filtering, sorting, pagination, and limits, and documented the Secure Public API
and Advanced Search modules.

The main challenges were securing public access without relying on a normal web
session, preventing unsafe or unbounded database queries, and making API keys
usable without exposing secrets after creation. These were handled with hashed
keys, one-time secret display, request validation, bounded pagination, and
Prisma query objects instead of raw string-built SQL.

# Resources

## Modules

### Backend Microservices

* https://docs.docker.com/
* https://docs.docker.com/compose/
* https://github.com/maxproske/nextjs-docker-production-kit

### Secure Public API

* https://nextjs.org/blog/building-apis-with-nextjs

### ORM

* https://www.prisma.io/docs/orm
* https://www.postgresql.org/docs/
* https://github.com/samchon/prisma-markdown
* https://mermaid.ai/live/edit

## AI Usage

AI tools were used to help draft documentation, review explanations,
generate test ideas, and clarify implementation approaches. All generated
content was reviewed and adapted by the team before being added to the
project.
