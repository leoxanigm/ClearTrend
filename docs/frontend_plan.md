# ClearTrend - frontend reference

Document court pour comprendre vite le front, eviter de relire tout le code, et
garder une vraie todo list. Derniere mise a jour: 2026-05-13.

## Direction produit

ClearTrend est un dashboard financier educatif: watchlist, courbes, tendance,
sentiment et exports. L'interface doit rester ouvert aux neophytes, lisible et orientee demo,
pas terminal de trading.

Modules surtout portes par le frontend:

- **Major - Analytics dashboard avance**: chart interactif, ranges, filtres,
  cartes trend/sentiment, export.
- **Minor - 3 langues**: EN/FR/ES recommande.
- **Minor - Advanced search**: recherche assets plus propre, filtres, etats API.
- **Minor - Data export/import**: watchlist CSV/JSON.
- **Minor - OAuth**: boutons et retours d'erreur propres cote login.
- **Minor - Design system**: viser au moins 10 composants reutilisables.

## Etat actuel

Fait:

- login/register email/password + OAuth Google/GitHub/42;
- dashboard protege;
- user menu avec theme, logout, profile settings;
- avatar upload local avec crop rond, zoom et deplacement;
- watchlist initiale, tri, recherche Finnhub, ajout en memoire;
- chart SVG avec ranges `1D`, `1M`, `3M`, `1Y`, axes, tooltip desktop;
- APIs assets protegees par session;
- cache/cooldown 5 min pour assets, search et candles;
- dark/light theme via CSS variables et `localStorage`;
- pages `/privacy` et `/terms`.

A retenir:

- les assets sont caches en DB;
- search Finnhub et candles Twelve Data ont un cache en memoire;
- la watchlist utilisateur n'est pas encore persistee;
- Trend/Sentiment sont encore des placeholders.

## Mini map frontend

### App shell

- `web/src/app/layout.tsx`: root layout, metadata, providers.
- `web/src/app/providers.tsx`: `SessionProvider` NextAuth.
- `web/src/app/globals.css`: tokens theme, layout, dashboard, profil, chart.
- `web/src/app/page.tsx`: redirection vers `/login`.

### Login

- `web/src/app/login/page.tsx`: UI login/register.
- `web/src/app/login/login.tsx`: hook `useLoginPage`, submit, session check.
- `web/src/app/login/OAuthButtons.tsx`: boutons Google/GitHub/42.
- UI reutilisee: `Button`, `TextInput`, `SegmentedControl`, `FooterLinks`,
  `AppLogo`.

### Dashboard

- `web/src/app/dashboard/page.tsx`: server component, verifie le user, charge la
  watchlist initiale.
- `web/src/components/DashboardClient.tsx`: state principal du dashboard
  (`profile`, `watchlistAssets`, `selectedSymbol`), user menu, drawer mobile.
- `web/src/components/WatchlistNav.tsx`: recherche, tri, selection, ajout asset.
- `web/src/components/AssetChart.tsx`: fetch candles, rendu SVG, ranges,
  tooltip desktop.
- `web/src/components/ProfileSettingsDialog.tsx`: popup profil, display name,
  avatar, boutons watchlist placeholder.
- `web/src/components/UserAvatar.tsx`: rendu avatar/initiale + helpers de crop.

### Shared UI

- `web/src/components/ui/Button.tsx`
- `web/src/components/ui/TextInput.tsx`
- `web/src/components/ui/SegmentedControl.tsx`
- `web/src/components/ui/ThemeSwitch.tsx`
- `web/src/components/AppLogo.tsx`
- `web/src/components/FooterLinks.tsx`

### Server/API utiles au front

- `web/src/app/api/profile/route.ts`: read/update profil, upload avatar.
- `web/src/app/api/assets/watchlist/route.ts`: hydrate des symbols en assets.
- `web/src/app/api/assets/search/route.ts`: recherche Finnhub.
- `web/src/app/api/assets/candles/route.ts`: candles Twelve Data.
- `web/src/lib/profile.ts`: user courant et profil.
- `web/src/lib/profile-rules.ts`: validation display name + crop avatar.
- `web/src/lib/assets.ts`: watchlist defaults, cache DB assets.
- `web/src/lib/finnhub.ts`: provider Finnhub.
- `web/src/lib/twelvedata.ts`: provider Twelve Data.
- `web/src/lib/external-data.ts`: cooldown 5 min provider.

## Todo priorisee

### P0 - Stabiliser l'experience demo

- [ ] Persister la watchlist par user.
  - Ajouter `watchlists` et `watchlist_items` dans Prisma.
  - Charger la watchlist du user dans `/dashboard`.
  - Transformer l'ajout actuel en write DB.
  - Prevoir remove/reorder plus tard, mais pas obligatoire MVP.

- [ ] Gerer les erreurs API cote UI.
  - `401`: redirection login ou message session expiree.
  - `429`: message "try again shortly" au lieu de "failed".
  - provider down: garder l'ancienne data visible quand possible.

- [ ] Finir les boutons watchlist du profil.
  - Download CSV/JSON.
  - Upload CSV/JSON.
  - Import depuis texte colle ou fichier.
  - Validation symboles + preview avant save.

- [ ] Connecter Trend/Sentiment a de vraies donnees.
  - V1 possible: indicateur technique simple en backend.
  - V2: FastAPI analysis + sentiment/news/comments.

### P1 - Modules frontend choisis

- [ ] Multi langue EN/FR/ES.
  - Choisir lib (`next-intl` ou equivalent simple).
  - Sortir les strings UI dans des dictionnaires.
  - Ajouter selecteur de langue dans user menu ou settings.
  - Traduire login, dashboard, profil, erreurs, legal pages.

- [ ] Advanced search.
  - Resultats mieux structures: symbol, name, type, exchange.
  - Etats loading/empty/error plus precis.
  - Debounce + annulation deja presents, mais messages a ameliorer.
  - Eventuellement filtres stock/crypto.

- [ ] Analytics dashboard avance.
  - Remplacer les cartes placeholder.
  - Ajouter volume/variation/range summary.
  - Ajouter export chart/watchlist.
  - Decider si le SVG custom suffit ou si ECharts devient utile.

- [ ] Design system 10 composants.
  - Deja presents: `Button`, `TextInput`, `SegmentedControl`, `ThemeSwitch`,
    `AppLogo`, `FooterLinks`, `UserAvatar`.
  - A extraire: `Modal`, `Drawer`, `Card`, `MetricTile`, `Select`, `Tooltip`.

### P2 - Robustesse avant evaluation

- [ ] Accessibilite modales/drawer.
  - Focus trap dans profile dialog et crop dialog.
  - Restaurer le focus a la fermeture.
  - `aria-live` sur messages formulaire/API.
  - Drawer mobile avec etat explicite plutot que checkbox cachee si besoin.

- [ ] Reduire les gros composants.
  - `ProfileSettingsDialog`: extraire avatar/crop/form/footer.
  - `AssetChart`: extraire fetch hook + helpers chart.
  - `WatchlistNav`: extraire search hook + item.

- [ ] Check responsive/console.
  - Desktop, tablette, mobile.
  - Login/register/OAuth/logout.
  - Watchlist search/add.
  - Chart ranges/tooltip.
  - Profile avatar upload/crop/remove.
  - Console Chrome propre.

## Decisions ouvertes

- Watchlist: une seule liste par user ou plusieurs listes nommees ?
- Import watchlist: remplacer toute la liste ou merge avec l'existant ?
- Langues: EN/FR/ES confirme ou autre 3e langue ?
- Chart: rester SVG custom ou passer ECharts pour candles/volume/indicators ?
- Candles: cache memoire seulement ou stockage DB si backtesting/demo offline ?
- Mobile chart: interaction tap/long press ou lecture simple ?

## Notes implementation

- Garder les appels providers cote serveur uniquement.
- Ne jamais exposer les tokens Finnhub/Twelve Data au client.
- Toute route asset doit verifier la session avant de fetch externe.
- Garder 5 min minimum entre deux appels provider pour le meme besoin.
- Si une donnee stale existe, preferer l'afficher plutot que casser l'UI.
- En dev Docker, si CSS/Next semble stale, recreer le container web:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --no-deps --force-recreate --renew-anon-volumes web
```
