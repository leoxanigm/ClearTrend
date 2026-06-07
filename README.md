*This project has been created as part of the 42 curriculum by amoureau, elhirond, mathboye and zalemu*

# Description

Transcendence is a web application base for a financial analysis dashboard.

Current starter scope:

- Next.js web application with React and TypeScript.
- FastAPI analysis service for market data and future analysis helpers.
- PostgreSQL database managed from the web service with Prisma.
- Docker Compose setup for development and evaluation-like HTTPS mode.
- Database backup command through Docker.

# Instructions

Prerequisites:

- Docker with Docker Compose.
- Make.
- OpenSSL for local certificate generation.

Start the development environment:

```sh
make dev
```

Development mode starts `web`, `analysis`, and `db` with hot reload and plain HTTP:

- Web: http://localhost:3000
- Web health: http://localhost:3000/api/health
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

## Major - Frontend and Backend Frameworks

The project uses modern frameworks for both the user interface and the server side.

Proofs:

- Frontend: Next.js with React and TypeScript for pages and UI components.
- Backend: Next.js API routes for authentication, user data, public API, and health checks.
- Backend: FastAPI service for market data endpoints used by the web application.

## Minor - Additional Browsers

The main interface was manually checked on Chrome, Firefox, and Edge.

Proofs:

- Chrome: login, dashboard, watchlist, charts, profile, theme, and languages display correctly.
- Firefox: same user flows display correctly.
- Edge: same user flows display correctly.

## Minor - Custom Design System

The interface uses a small custom UI library with shared tokens and generic reusable components.

Proofs:

The component library can be checked visually on `/ui-showcase`. This page is not linked in the product navigation and is meant to be opened only by direct URL.

15 Reusable components:

- Button, IconButton, TextInput, SelectField, SegmentedControl.
- Badge, Card, MetricTile, Avatar, DropdownMenu.
- Modal, Tooltip, Toast, ThemeSwitch, NotificationProvider.

The design system also centralizes light/dark tokens, surfaces, borders, text colors, accent colors, and shared UI CSS. App screens reuse these primitives on login, dashboard, profile settings, menus, charts, and admin forms, with UI assets such as logo variants, OAuth icons, theme icons, and favorite icons.

## Major - Backend Microservices

The backend is split into independent services with clear responsibilities and internal REST communication.

Proofs:

The `web` service is the application backend: authentication, user profile, watchlist, admin settings, public API routes, and database writes through Prisma.

The `analysis` service is a separate FastAPI backend: market data cache warmup, scheduled refresh, ticker list, snapshots, performances, candles, and health endpoint.

Communication between services uses REST over the Docker network with `ANALYSIS_URL=http://analysis:8000`. The web backend validates user input, calls the analysis backend server-side, normalizes the response, and exposes protected API routes to the frontend.

Docker Compose runs `web`, `analysis`, `db`, and `proxy` as separate services with healthchecks. The global `/api/health` endpoint reports the status of the web backend, database, and analysis backend.

## Major - Advanced Analytics Dashboard

Status: in progress, not fully validated yet.

The dashboard already provides an interactive financial view connected to the analysis backend. Users can select assets, switch chart ranges, inspect price points on hover, track watchlist performance by period, and see loading/error states when market data is unavailable.

Current progress:

- Interactive SVG price chart with hover tooltip, axes, volume, provider, interval, and last update metadata.
- Market ranges: `1D`, `1W`, `1M`, `3M`, `1Y`.
- Watchlist performance range selector connected to `/api/assets/performance`.
- Client refresh logic connected to the analysis service cache and visibility changes.

Still missing before validation:

- CSV/JSON export for chart or dashboard data.
- Real sentiment timeline and trend score connected to analysis data.
- More advanced filters beyond asset and range selection.
- Manual validation with complete demo data and expected empty/error states.

Advanced search is tracked separately and still needs backend/data validation before it can be considered finished.

## Major - Real-time WebSocket/SSE

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


NEXT CHECK : 
- ORM | 1 
- Recommendation ML | 2 
- Advanced search | 1 
- Health/status/backups/DR | 1 
- Public API securisee | 2
- OAuth 2.0 | 1 
- Notifications CRUD | 1 
- 3 langues | 1

# Individual Contributions

## amoureau

## elhirond

## mathboye

## zalemu

(rough bullet points to remember. edit and explain later)
* Prisma ORM for tables
* Advanced search
* public API
