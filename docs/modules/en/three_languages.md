# Module 3 Languages

## Status

- Type: minor module
- Value: 1 point
- Status: implemented and validated
- Library: `next-intl` (Internationalization (i18n))
- Languages: English (`en`), French (`fr`), and Spanish (`es`)

The subject requires:

- an internationalization system;
- at least three complete translations;
- a language selector in the interface;
- translatable user-facing text.

ClearTrend uses three dictionaries with the same structure and resolves the
language for each Next.js request.

## i18n Architecture

The resolution cycle is:

```text
Browser request
      |
      +--> valid cleartrend-locale cookie?
      |        |
      |        +--> yes: use this choice
      |
      +--> otherwise: read Accept-Language
      |
      +--> no supported language: English
               |
               v
Load web/langages/{locale}.json
               |
               v
NextIntlClientProvider
               |
               v
Server pages and client components
```

Supported locales and the default locale are centralized in
`web/src/i18n/locales.ts`.

The `web/src/i18n/request.ts` configuration:

1. reads the `cleartrend-locale` cookie;
2. verifies that it is `en`, `fr`, or `es`;
3. otherwise, parses the HTTP `Accept-Language` header;
4. extracts the main language from values such as `fr-FR` or `es-ES`;
5. uses English when no supported language is found;
6. dynamically loads the corresponding JSON dictionary.

## Next.js Integration

Implementation:
[web/src/app/layout.tsx](../../../web/src/app/layout.tsx)

The root layout retrieves the locale and messages server-side with:

```text
getLocale()
getMessages()
```

`getLocale()` returns the resolved locale for the current request, for example
`fr`. `getMessages()` returns the corresponding JSON dictionary already loaded
by the `i18n/request.ts` configuration.

It then provides translations to client components with
`NextIntlClientProvider`.

For example, if the French dictionary contains:

```json
{
  "dashboard": {
    "title": "Vue d'ensemble"
  }
}
```

The provider makes this dictionary available to all child components:

```tsx
<NextIntlClientProvider messages={messages}>
  <Dashboard />
</NextIntlClientProvider>
```

The component can then retrieve the text with:

```tsx
function Dashboard() {
  const t = useTranslations("dashboard");

  return <h1>{t("title")}</h1>;
}
```

The displayed result is `Vue d'ensemble`.

The HTML attribute is also adapted:

```html
<html lang="fr">
```

This informs the browser and assistive technologies of the active language.

Server and interactive components use `getTranslations`.

## Language Switching

The `LanguageSelect` component is available:

- on the login page;
- in the dashboard user menu.

On change:

1. the component writes the `cleartrend-locale` cookie;
2. the cookie is kept for one year;
3. `SameSite=Lax` limits sending it in some third-party contexts;
4. `router.refresh()` reloads the server components of the current route;
5. the new locale and dictionary are used.

The change does not modify the URL. Users therefore remain on the same page,
with the same asset and time range.

This choice simplifies existing routes and avoids `/fr/dashboard`,
`/en/dashboard`, and `/es/dashboard` variants. In return, a URL cannot force a
specific language for its recipient.

## Dictionaries

The files are:

```text
web/langages/en.json
web/langages/fr.json
web/langages/es.json
```

Each dictionary currently contains:

- 17 main namespaces;
- 399 messages;
- exactly the same keys.

Namespaces separate interface domains, including:

- `common`;
- `login` and `oauth`;
- `dashboard`, `watchlist`, and `chart`;
- `profile`;
- `language` and `theme`;
- `searchPage`;
- `apiDocsPage` and `apiKeyPage`;
- `adminPage` and `analystPage`;
- `statusPage`;
- `legal` and `footer`.

Variables are injected with `next-intl` mechanisms, for example for a price, a
message count, or an asset name.

## Covered Screens

Translations are used in:

- sign-in and sign-up;
- OAuth buttons;
- dashboard;
- watchlist and sorting;
- chart, filters, exports, and metadata;
- AI analysis;
- profile settings;
- watchlist import/export;
- advanced search;
- API documentation;
- API key management;
- administration;
- analyst page;
- status page;
- terms of use and privacy;
- footer;
- theme selector.

Number and date formats also rely on `Intl.NumberFormat`,
`Intl.DateTimeFormat`, and `Intl.RelativeTimeFormat` in financial components.

## Technical Choices

### `next-intl`

`next-intl` was chosen because it works with the Next.js App Router and can be
used in both server components and client components.

This avoids maintaining two different mechanisms for server-rendered pages and
browser interactions.

### JSON Dictionaries

JSON dictionaries are easy to compare, version, and review without knowing
React. A stable key represents the meaning of the text rather than its visual
position.

### Cookie Rather Than Local Storage

The server must know the language before rendering the page. A cookie is sent
with the HTTP request, unlike `localStorage`, which is only available after
JavaScript loads.

The cookie is not `HttpOnly` because `LanguageSelect` must be able to modify it
from the browser. It contains no sensitive information.

## Main Files

| File | Role |
|---|---|
| `web/src/i18n/locales.ts` | Locale list, default value, and `Accept-Language` parsing |
| `web/src/i18n/request.ts` | Locale resolution and dictionary loading |
| `web/src/app/layout.tsx` | Global provider and HTML `lang` attribute |
| `web/src/components/ui/LanguageSelect.tsx` | Selector, cookie, and refresh |
| `web/langages/en.json` | English translations |
| `web/langages/fr.json` | French translations |
| `web/langages/es.json` | Spanish translations |

All components that call `useTranslations` or `getTranslations` also
participate in the module.

## Automatic Key Verification

The following command counts messages and compares keys:

```bash
python3 - <<'PY'
import json
from pathlib import Path

def flatten(value, prefix=""):
    result = {}
    for key, child in value.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(child, dict):
            result.update(flatten(child, path))
        else:
            result[path] = child
    return result

root = Path("web/langages")
dictionaries = {
    locale: flatten(json.loads((root / f"{locale}.json").read_text()))
    for locale in ("en", "fr", "es")
}

reference = set(dictionaries["en"])
for locale, messages in dictionaries.items():
    keys = set(messages)
    assert keys == reference, (
        locale,
        sorted(reference - keys),
        sorted(keys - reference),
    )
    print(locale, len(messages), "messages")
PY
```

Expected result:

```text
en 399 messages
fr 399 messages
es 399 messages
```

TypeScript and ESLint verification complete this check:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run lint

docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npx tsc --noEmit
```

## Manual Test

1. Delete the `cleartrend-locale` cookie.
2. Configure the browser in French and open the login page.
3. Verify that French is selected automatically.
4. Choose Spanish from the selector.
5. Navigate to the dashboard.
6. Verify the dashboard, watchlist, chart, and profile.
7. Reload the page and verify that Spanish is preserved.
8. Choose English from the user menu.
9. Test long text on a mobile width.

## Limitations

- Translations are LTR; RTL support is a separate module.
- The language does not appear in the URL, so a shared URL does not carry the
  locale choice.
- The internal `/ui-showcase` page intentionally contains examples in English
  and French; it is not part of the product journey.
- Some invariant values remain the same in every language, such as `A-Z`,
  `ADMIN`, stock symbols, and the names Google/GitHub/42.
- Technical API messages and server logs are mostly in English. The interface
  translates expected errors when they are shown to the user.
- Global browser metadata uses the product name `ClearTrend` and a non-localized
  English description.
- Key parity is verified, but there is no automated check for the linguistic
  quality of translations.

The module guarantees three complete languages for the main screens and an
architecture that allows adding a new locale without modifying feature
components.
