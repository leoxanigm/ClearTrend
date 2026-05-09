# ClearTrend frontend plan

This document keeps the frontend decisions in one place before implementation.

## Product name

Chosen name: **ClearTrend**

Reason:

- short and easy to remember;
- directly communicates the goal of the app: making financial trends easier to read;
- English name fits the README and evaluation context;
- neutral enough to work for a serious finance dashboard without sounding too technical.

## Frontend direction

The UI should feel modern, smooth, and approachable for beginners.

It should not look like Excel, Bloomberg, or a dense trading terminal. The goal is to make financial analysis easier to understand, not to overwhelm users with raw data.

Main principles:

- calm interface;
- limited information on the first screen;
- one dominant chart area;
- clear watchlist;
- readable metrics;
- progressive details when the user selects an asset;
- English text first;
- dark/light theme prepared from the beginning.

## Routes

We will use separate routes instead of putting everything inside one page.

Planned routes:

- `/login` - public login/register page;
- `/dashboard` - main authenticated dashboard;
- `/privacy` - Privacy Policy page;
- `/terms` - Terms of Service page.

Why not everything on one page:

- separate URLs are easier to explain and test;
- auth protection is cleaner later;
- Privacy Policy and Terms of Service are easier to validate during evaluation;
- dashboard code stays simpler;
- refresh/navigation behavior is more predictable.

The dashboard itself can still behave like a single-page app: selecting a stock changes the visible data without leaving `/dashboard`.

## Login page

Layout:

- centered login/register block;
- temporary SVG logo;
- project name: ClearTrend;
- login and register on the same page;
- footer visible with links to Privacy Policy and Terms of Service.

Login/register interaction:

- use tabs or a segmented control;
- first implementation can be static;
- auth wiring comes later.

## Dashboard page

Initial layout:

- left sidebar always visible;
- main chart area in the center;
- simple performance indicators below or near the chart;
- user menu in the top-right area;
- footer visible in the app shell.

Sidebar:

- contains watched assets / watchlist;
- always visible for now;
- animations/collapse can be added later to make the interface smoother.

User menu:

- theme toggle;
- edit profile;
- logout;
- future settings entries.

Dashboard information hierarchy:

1. selected asset name and symbol;
2. main trend/chart;
3. few key indicators;
4. watchlist;
5. optional details.

Do not show too many widgets in the first version.

## Footer

The footer should be visible everywhere, not only on the login page.

It should contain:

- Privacy Policy;
- Terms of Service.

On dashboard, the footer should be discreet so it does not compete with the main UI.

## Theme and colors

We prepare both dark and light themes early with CSS variables.

The palette has more than five values because each value has a different UI role. They are not all meant to be equally visible.

### Dark theme

| Token | Value | Role |
|---|---:|---|
| `background` | `#0B1116` | Main app background |
| `surface` | `#111A22` | Cards, panels, app shell |
| `panel` | `#16232D` | Nested or highlighted sections |
| `border` | `#263642` | Dividers and borders |
| `text` | `#EAF2F5` | Primary text |
| `muted` | `#8FA4AE` | Secondary text |
| `accent` | `#2DD4BF` | Main action, selected state, positive highlight |
| `secondary` | `#2563EB` | Secondary action or informational highlight |

### Light theme

| Token | Value | Role |
|---|---:|---|
| `background` | `#F6F8FA` | Main app background |
| `surface` | `#FFFFFF` | Cards, panels, app shell |
| `panel` | `#EEF4F6` | Nested or highlighted sections |
| `border` | `#DCE5EA` | Dividers and borders |
| `text` | `#102027` | Primary text |
| `muted` | `#647985` | Secondary text |
| `accent` | `#0F766E` | Main action, selected state, positive highlight |
| `secondary` | `#1D4ED8` | Secondary action or informational highlight |

### About accent and secondary colors

Accent and secondary are intentionally more saturated than the base palette, but they must be used sparingly.

Use accent for:

- primary button;
- active tab;
- selected asset;
- positive or confirmed state;
- small chart highlights.

Use secondary for:

- links;
- secondary actions;
- informational badges;
- focus states if accent is already used.

Avoid large full-screen blocks in accent or secondary colors. The global UI should remain neutral and calm.

## First design system components

Do not build the full design system at once.

First useful components:

- `Button`;
- `Input`;
- `SegmentedControl`;
- `Footer`;
- `AppLogo`;

Next components:

- `Sidebar`;
- `UserMenu`;
- `MetricTile`;
- `ChartPanel`;
- `ThemeToggle`.

This path keeps the code simple while preparing the future "custom design system" module.

## Implementation steps

### Step 1 - Static routes

Create:

- `/login`;
- `/dashboard`;
- `/privacy`;
- `/terms`.

No auth logic yet.

### Step 2 - Login/register UI

Implement:

- centered login page;
- logo placeholder;
- ClearTrend title;
- login/register tabs;
- email/password inputs;
- footer links.

### Step 3 - Dashboard static shell

Implement:

- left sidebar;
- main chart placeholder;
- watchlist placeholder;
- user menu placeholder;
- footer links.

### Step 4 - Theme foundations

Implement CSS variables for dark and light themes.

Do not overbuild the toggle yet. The theme system should be ready before the UI grows.

### Step 5 - Connect auth and data

Only after the static layout is stable:

- wire login/register;
- protect `/dashboard`;
- connect real watchlist data;
- replace chart placeholder.

## Current decisions

- Project name: ClearTrend.
- UI language first: English.
- Routes: separate pages.
- Login/register: same page.
- Login layout: centered.
- Dashboard: left sidebar always visible for now.
- Footer: visible everywhere.
- Style: modern, approachable, smooth, not too dense.
- Theme: dark/light prepared early.

## Implementation checklist

Status legend:

- `[x]` done in the current repo;
- `[ ]` not done yet.

### Routes and pages

- [x] `/` redirects to `/login`.
- [x] `/login` exists.
- [x] `/dashboard` exists.
- [x] `/privacy` exists.
- [x] `/terms` exists.
- [x] Privacy Policy has non-empty content.
- [x] Terms of Service has non-empty content.

### Login and register UI

- [x] Centered login/register page.
- [x] Logo visible on the login page.
- [x] ClearTrend has fallback text through logo `alt` text.
- [x] Login/register tabs.
- [x] Email input.
- [x] Password input.
- [x] Confirm password input in register mode.
- [x] Footer links to Privacy Policy and Terms of Service.
- [x] Register loading/error/success feedback.
- [x] Login loading/error/success feedback connected to a real backend route.

### Auth backend and session

- [x] Prisma client helper exists in `web/src/lib/prisma.ts`.
- [x] `User` model exists with `email`, `passwordHash`, `createdAt`, and `updatedAt`.
- [x] User email is unique in the Prisma schema.
- [x] Register API route exists at `/api/auth/register`.
- [x] Passwords are hashed server-side with `bcryptjs`.
- [x] Register input validation is complete server-side.
- [ ] Shared validation schema exists for front/back, for example with Zod.
- [x] Duplicate email returns a specific `409 Conflict` instead of generic `500`.
- [x] Login API route exists.
- [x] Login compares passwords with `bcrypt.compare`.
- [x] Session storage or signed session cookie exists.
- [x] Auth cookie is `HttpOnly`, `Secure` in production, and `SameSite`.
- [x] Logout route/action exists.
- [x] `/dashboard` is protected from unauthenticated users.

### Dashboard shell

- [x] Left sidebar exists.
- [x] Hardcoded watchlist placeholder exists.
- [x] Main chart placeholder exists.
- [x] Basic metric cards exist.
- [x] User menu placeholder exists.
- [x] Footer links exist inside the dashboard shell.
- [x] Dashboard uses real authenticated user data.
- [ ] Watchlist is loaded from the database/API.
- [ ] Chart placeholder is replaced by a real chart component.
- [ ] Dashboard is validated on mobile/tablet layouts.

### Theme and styling

- [x] CSS variables exist for the light theme.
- [x] CSS variables exist for the dark theme.
- [x] Theme follows `prefers-color-scheme`.
- [ ] Manual theme toggle exists.
- [ ] Theme preference is persisted per user or browser.

### Shared components / design system

- [x] First CSS classes exist for buttons, inputs, cards, links, tabs, and shell.
- [ ] `AppLogo` component extracted.
- [ ] `Footer` component extracted.
- [ ] `Button` component extracted.
- [ ] `Input` component extracted.
- [ ] `SegmentedControl` component extracted.
- [ ] Design system reaches the 10 component target from the feature breakdown.

### Feature breakdown alignment

- [x] Next.js App Router is used for frontend pages.
- [x] Next.js Route Handlers are used for backend routes.
- [x] Prisma ORM is started.
- [x] PostgreSQL health check route exists at `/api/health`.
- [x] Auth email/password is complete enough for the mandatory base.
- [ ] Validation front/back is complete enough for the mandatory base.
- [ ] Docker one-command flow is verified after the current frontend changes.
- [ ] HTTPS/proxy flow is verified after the current frontend changes.
- [ ] Dashboard has advanced analytics/charts.
- [ ] Public API endpoints are implemented.
- [ ] Advanced search is implemented.
- [ ] Notifications CRUD or SSE are implemented.
- [ ] i18n with three languages is implemented.
- [ ] Playwright/manual evaluation checklist exists for login, dashboard, API, and console warnings.

## Next recommended work

The basic email/password auth path is now connected. The next priority should be
validation quality and cleanup before the dashboard grows.

Recommended order:

1. Replace the ad hoc auth validation with a shared schema, ideally Zod, reused by
   register and login.
2. Add a small manual/Playwright test checklist for register, duplicate email,
   login, protected dashboard redirect, logout, legal pages, health route, and
   console warnings.
3. Extract the repeated UI into small shared components: `AppLogo`, `Footer`,
   `Button`, `Input`, and `SegmentedControl`.
4. Connect the dashboard to real data: watchlist API, persisted user watchlist,
   then a real chart component.
5. Verify Docker one-command and HTTPS/proxy flows after the auth changes.
