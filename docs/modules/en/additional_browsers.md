# Module Additional Browsers

## Status

- Type: minor module
- Value: 1 point
- Status: implemented and manually validated
- Browsers: Chrome, Firefox, and Microsoft Edge

The subject requires full compatibility with at least two additional browsers,
a consistent interface, and documentation of browser-specific limitations.

Chrome is the reference browser. Firefox and Edge are the two additional
browsers verified for ClearTrend.

## Verified Scope

The following flows were checked on all three browsers:

1. opening the login page;
2. signing up and signing in;
3. displaying the dashboard;
4. navigating and sorting the watchlist;
5. changing the asset and time range;
6. displaying the line chart and candlesticks;
7. opening and editing profile settings;
8. changing the theme;
9. changing the language;
10. responsive display of the main views.

The functional result is identical: controls remain usable, data is loaded, and
the main information does not overlap.

## Technical Choices Supporting Compatibility

The frontend mostly relies on widely supported Web standards:

- React and Next.js for rendering;
- native HTML for buttons, fields, lists, details, and forms;
- Flexbox and CSS Grid for layouts;
- CSS variables for colors and themes;
- SVG for financial charts;
- `fetch`, `URL`, `Intl`, cookies, `localStorage`, and `sessionStorage` for
  browser features;
- media queries for responsive behavior.

The chart does not use browser plugins or proprietary rendering. Lines, axes,
and candlesticks are standard SVG elements, which gives similar behavior across
Chromium and Firefox.

Date fields, dropdowns, and file controls remain native elements. Their
appearance can vary slightly by browser, but their function and labels remain
the same.

## Browser-Specific Details

Some styles are intentionally progressive:

- `::-webkit-scrollbar` customizes the watchlist scrollbar in Chrome and Edge;
- Firefox keeps its native scrollbar or uses `scrollbar-width` when defined;
- `::-webkit-details-marker` hides the native marker in Chromium browsers,
  while the standard `summary::marker` rule covers Firefox;
- `color-mix()`, `aspect-ratio`, `100svh`, and `100dvh` assume a recent browser
  version.

These differences concern fine presentation details. They do not block user
actions.

## Main Files Involved

| File | Role |
|---|---|
| `web/src/app/globals.css` | Responsive rules, layouts, and rendering-engine adjustments |
| `web/src/components/ui/ui.css` | Generic component styles |
| `web/src/components/AssetChart.tsx` | SVG chart and mobile adaptation |
| `web/src/components/DashboardClient.tsx` | Dashboard structure and interactions |
| `web/src/components/WatchlistNav.tsx` | Navigation, sorting, and scrollable area |
| `web/src/components/ProfileSettingsDialog.tsx` | Forms, files, and pointer interactions |
| `web/src/components/ui/ThemeSwitch.tsx` | System theme and local persistence |
| `web/src/components/ui/LanguageSelect.tsx` | Language cookie and refresh |

In practice, this module covers the whole frontend: any CSS, form, or
interaction change should be rechecked on all three browsers.

## Verification Procedure

1. Start the application with `make dev`.
2. Open `http://localhost:3000` in Chrome, Firefox, and Edge.
3. Use the same test account in each browser.
4. Execute the flows listed in the verified scope.
5. Test at least one desktop width and one mobile width.
6. Check the browser console while the dashboard is loading.
7. Verify that long French and Spanish texts remain readable.

For the local HTTPS environment, the certificate is self-signed. The security
warning displayed by the browser is expected and does not indicate a frontend
compatibility issue.

## Limitations

- The exact browser versions used during manual checks are not recorded in the
  repository.
- Native fields, calendars, file selectors, and scrollbars can vary slightly in
  appearance.
- Extensions, anti-tracking protections, and user-machine cookie policies can
  affect OAuth or the clipboard without being a ClearTrend rendering bug.

These limitations should be considered when making a significant frontend
change. The compatibility claimed by this module only covers Chrome, Firefox,
and Edge on recent desktop versions.
