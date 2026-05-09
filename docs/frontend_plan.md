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

## Implementation status

### Done - Static routes

Created files:

- `web/src/app/page.tsx` redirects `/` to `/login`;
- `web/src/app/login/page.tsx` contains a first static login/register screen;
- `web/src/app/dashboard/page.tsx` contains a first static dashboard shell;
- `web/src/app/privacy/page.tsx` contains the Privacy Policy route;
- `web/src/app/terms/page.tsx` contains the Terms of Service route.

Current limitations:

- no authentication logic yet;
- login/register tabs are static;
- dashboard data is hardcoded;
- footer and logo are still duplicated instead of being shared components;
- dark/light theme variables are not implemented yet.

Next recommended step:

- create the first small shared components: `AppLogo`, `Footer`, `Button`, and `Input`.
