# Module Custom Design System

## Status

- Type: minor module
- Value: 1 point
- Status: implemented and validated
- Demonstration: `/ui-showcase`

The subject requires a design system created for the project with:

- a consistent color palette;
- consistent typography;
- an icon system;
- at least ten reusable components.

ClearTrend provides an internal React component library, light/dark theme
tokens, and a demonstration page available directly by URL.

## Organization

The design system is organized in three layers:

```text
Visual tokens
  globals.css
      |
      v
Generic primitives
  components/ui/*.tsx + components/ui/ui.css
      |
      v
Application compositions
  LanguageSelect, UserAvatar, forms, and screens
```

Components use native HTML elements whenever possible. For example, `Button`
remains a real button, `SelectField` remains a real `select`, and
`DropdownMenu` relies on `details/summary`.

This choice preserves baseline keyboard and browser behavior, limits external
dependencies, and keeps the components easy to read.

## Palette and Themes

The main colors are declared as CSS variables:

| Token | Usage |
|---|---|
| `--app-background` | Main background |
| `--app-surface` | Cards, modals, and panels |
| `--app-panel` | Secondary surface |
| `--app-border` | Borders and separators |
| `--app-text` | Main text |
| `--app-muted` | Secondary text |
| `--app-accent` | Highlighted action or information |
| `--app-secondary` | Second functional color |
| `--app-accent-contrast` | Text placed on the accent color |

Two complete palettes are available:

- light theme in `:root`;
- dark theme in `:root[data-theme="dark"]`.

Without a user choice, `prefers-color-scheme` follows the system theme. The
`ThemeSwitch` component then stores the choice in `localStorage` under the
`cleartrend-theme` key.

The `/ui-showcase` page displays tokens as samples so their rendering can be
checked quickly in both themes.

## Typography

The project uses the sans-serif stack provided by Tailwind and the browser,
without loading a remote font. Components inherit global typography with
`font: inherit`.

The hierarchy relies on:

- distinct sizes for titles, values, labels, and helper text;
- consistent weights for actions and important data;
- `letter-spacing: 0` to keep reading regular;
- secondary text connected to the `--app-muted` token.

Not loading a remote font speeds up loading and avoids layout shifts while it
downloads.

## Reusable Components

### Primitives

| Component | Main role |
|---|---|
| `Avatar` | Circular image or text fallback |
| `Badge` | Short status with default, accent, success, warning, and danger tones |
| `Button` | Primary, outline, plain, sidebar, or tab button |
| `Card` | Framed surface with optional padding |
| `DropdownMenu` | Generic menu based on `details/summary` |
| `IconButton` | Square button with accessible label, sizes, and pressed state |
| `MetricTile` | Statistic card with label, value, description, and tone |
| `Modal` | Backdrop and dialog/form/section panel |
| `SegmentedControl` | Exclusive selection built from tab buttons |
| `SelectField` | Generic typed and labelled select field |
| `TextInput` | Input field with label and configurable classes |
| `ThemeSwitch` | Persistent light/dark toggle |
| `Toast` | Temporary info, success, warning, or error message |
| `Tooltip` | Help on hover and keyboard focus |

### Compositions

| Component or service | Composition |
|---|---|
| `LanguageSelect` | `SelectField`, locale cookie, and Next.js refresh |
| `NotificationProvider` | React context, notification queue, and `Toast` rendering |

The minimum of ten components is therefore exceeded without counting business
components such as the chart, watchlist, or profile form.

## Reuse in the Application

The design system is not limited to the showcase:

- the login page uses `Card`, `Button`, `TextInput`, `SegmentedControl`, and
  `LanguageSelect`;
- the dashboard uses `Badge`, `Button`, `DropdownMenu`, `MetricTile`,
  `Tooltip`, `ThemeSwitch`, and `LanguageSelect`;
- the chart uses `Button`, `IconButton`, `SegmentedControl`, and `Tooltip`;
- profile settings use `Modal`, `TextInput`, `Button`, `IconButton`, and
  notifications;
- search uses the generic fields and buttons;
- administration reuses `Button` and `SelectField`;
- `UserAvatar` composes the generic `Avatar` component.

The `components/ui/index.ts` file also allows several primitives to be imported
from a single entry point.

## Icon System and Assets

The project uses several icon families:

- official SVGs for Google, GitHub, and 42 School;
- two bitmap variants of the ClearTrend logo for light and dark themes;
- small internal SVG icons for the theme;
- CSS symbols for close, add, remove, and open mobile menu actions;
- favorite star and AI badge in the watchlist.

Purely visual buttons use an `aria-label` provided by `IconButton` or directly
by the calling component.

## UI Showcase Page

The route:

```text
/ui-showcase
```

presents:

- base colors;
- button variants;
- a segmented control;
- icon buttons;
- form fields;
- badges;
- metric cards;
- the avatar;
- the dropdown menu;
- the tooltip;
- a notification;
- a modal;
- theme switching.

This page is not linked in product navigation. It serves as a visual catalog
and verification support during development.

## Built-In Accessibility

The primitives provide several shared foundations:

- real `button`, `input`, `select`, `label`, `details`, and `summary` elements;
- mandatory `aria-label` for `IconButton`;
- `aria-pressed` for binary states;
- `role="dialog"` and `aria-modal` for `Modal`;
- `role="status"` or `role="alert"` for `Toast`;
- `aria-live` region for notifications;
- tooltip visible on hover and `focus-visible`;
- `sr-only` class for labels kept only for screen readers.

These elements improve the semantic base, but the module does not claim full
WCAG 2.1 AA compliance on its own.

## Main Files

| File | Role |
|---|---|
| `web/src/components/ui/` | Reusable React components |
| `web/src/components/ui/ui.css` | Primitive, form, theme, selector, and notification styles |
| `web/src/components/ui/index.ts` | Grouped export point |
| `web/src/components/ui/cx.ts` | Simple composition of conditional classes |
| `web/src/app/globals.css` | Color tokens, page structure, and screen-specific overrides |
| `web/src/app/ui-showcase/page.tsx` | Demonstration route |
| `web/src/app/ui-showcase/UiShowcaseClient.tsx` | Interactive catalog |
| `web/public/` | Logos and OAuth icons |

## Verification

### Manual Verification

1. Open `/ui-showcase`.
2. Check each component in the light theme.
3. Switch to the dark theme.
4. Reduce the window width.
5. Test buttons, the select, the menu, the tooltip, the toast, and the modal.
6. Navigate through controls with the keyboard using `Tab`.
7. Then verify reuse on `/login` and `/dashboard`.

### Technical Verification

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run lint
```

ESLint analyzes code quality and reports some errors or bad practices.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npx tsc --noEmit
```

TypeScript checks types without generating files.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run build
```

The build compiles the Next.js application as it would for production and
detects errors that would block deployment.

## Limitations

- There are no automated visual tests or component snapshots.
- The icon system does not use a single library: it combines assets, internal
  SVGs, characters, and CSS shapes.
- Typography relies on the system sans-serif stack, without a dedicated brand
  font family.

These limitations mostly concern design-system industrialization. Tokens,
themes, the catalog, and more than ten reusable components are already used by
the product screens.
