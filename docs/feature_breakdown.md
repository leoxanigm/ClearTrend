# ClearTrend - feature breakdown


Objectif produit: dashboard financier simple qui collecte des courbes et des
commentaires publics, analyse la tendance et l'emotion, puis affiche une
recommendation expliquee. L'app doit rester une demo educative, pas un conseil
financier.

## Decisions courtes

- Garder le repo actuel: `web` en Next.js, `analysis` en FastAPI, `db` en
  PostgreSQL, `proxy` nginx HTTPS.
- Garder un seul document global pour l'instant. Des checklists par personne
  pourront venir apres validation.
- Donnees marche: API officielle si possible, scraping seulement en fallback,
  avec cache, source tracee, rate limit et seed local pour la demo.
- Temps reel: partir sur SSE pour notifications, statuts d'analyse et refresh
  dashboard. WebSocket/Socket.IO seulement si le module chat est fait.
- Langues recommandees: EN/FR/ES. Espagnol est moins risquee que RU/DE si
  personne ne peut relire correctement les traductions.
- Public API: exposer d'abord watchlists et notifications, puis assets/reports
  pour atteindre facilement les 5 endpoints demandes.
- OAuth: viser 42 + GitHub + Google si Auth.js est adopte proprement.

## Points et priorites

Modules coeur annonces: 20 pts.

| Module | Pts | Priorite | Owner principal | Support |
|---|---:|---|---|---|
| Framework frontend + backend | 2 | P0 | elhirond / amoureau | zalemu |	2
| Navigateurs additionnels | 1 | P2 | elhirond | tous |						1
| Design system 10 composants | 1 | P1 | elhirond | amoureau |				1	§
| Backend microservices | 2 | P2 risque | mathboys / amoureau | zalemu |	2
| Analytics dashboard avance | 2 | P1 | elhirond | mathboys |				
| Real-time WebSocket/SSE | 2 | P2 | amoureau | elhirond |					
| ORM | 1 | P0 | zalemu | amoureau |										1
| Recommendation ML | 2 | P2 risque | mathboys | zalemu |					2	§
| Advanced search | 1 | P1 | zalemu | elhirond |							1
| Health/status/backups/DR | 1 | P1 | zalemu | amoureau |					1
| Public API securisee | 2 | P1 | amoureau | zalemu |						2
| OAuth 2.0 | 1 | P2 | amoureau | elhirond |								1
| Notifications CRUD | 1 | P1 | amoureau | elhirond |						1	§
| 3 langues | 1 | P1 | elhirond | tous |									1

Tampon probable:

| Module | Pts | Avis |
|---|---:|---|
| RAG complet | 2 | Tres coherent avec news/commentaires/sources, mais il faut un vrai pipeline retrieval + generation + citations. |

Surplus de temps: attention, d'apres le sujet `User activity analytics and
insights dashboard` est un **minor a 1 point**, pas 2. La liste surplus ne fait
donc pas 18 pts avec le bareme du sujet.

## Repartition par personne

zalemu:

- Prisma schema, migrations, DB constraints.
- Search, pagination, filters.
- Backups/restore/status DB.
- Support API publique.

amoureau:

- Auth/session/API security.
- Public API, API keys, rate limit.
- Notifications CRUD + SSE.
- OAuth.

mathboys:

- FastAPI analysis service.
- Scraping/connecteurs et nettoyage.
- Sentiment/emotion.
- Recommendation ML.
- RAG si retenu.

elhirond:

- Dashboard, charts, design system.
- i18n.
- Browser compatibility.
- Support analytics UI et notifications UI.

## Decisions encore ouvertes

- Sources de donnees exactes: API finance, sites scrapees, commentaires.
- 3e langue finale: ES recommande, DE/RU seulement si quelqu'un relit.
- OAuth: Auth.js migration complete ou integration OAuth autour de l'auth custom.
- RAG: local embeddings + provider LLM, ou provider externe pour tout.
- Real-time: SSE valide pour coeur; WebSocket seulement si chat.


## Roadmap priorisee

1. P0 - Socle rejet/non rejet: Docker one command, HTTPS, auth email/password,
   DB relationnelle, validation front/back, Privacy/Terms, README anglais.
2. P1 - 14 pts solides: framework, ORM, public API, search, dashboard avance,
   design system, i18n, notifications, health/backups.
3. P2 - Bonus/tampon: real-time SSE, OAuth, microservices reels, ML
   recommendation, additional browsers.
4. P3 - Surplus: RAG, user management avance, 2FA, SSR, chat, WCAG,
   permissions, Prometheus/Grafana, ELK.

## Architecture cible

- `web`: Next.js App Router, pages, API routes publiques, auth, Prisma,
  notifications, SSE, dashboard.
- `analysis`: FastAPI, scraping/connecteurs, nettoyage, indicateurs techniques,
  sentiment/emotion, recommendation ML, RAG si retenu.
- `db`: PostgreSQL. Passer a une image pgvector si RAG est retenu.
- `proxy`: nginx HTTPS, route vers `web`, eventuellement vers docs/status.

Sources: [Next.js App Router](https://nextjs.org/docs/app),
[FastAPI](https://fastapi.tiangolo.com/),
[Prisma + Next.js](https://www.prisma.io/docs/guides/nextjs).

## Mandatory base

Minimum sujet: frontend, backend, DB, Docker one command, Chrome stable sans
warnings console, Privacy/Terms non vides, multi-user, auth email/password
securisee, validation front/back, HTTPS, README anglais complet.

Direction recommandee:

- Next.js pages pour `/login`, `/dashboard`, `/privacy`, `/terms`.
- Hash password cote serveur avec `bcryptjs` ou basculer vers Auth.js.
- Schemas Zod partages pour valider inputs dans les route handlers.
- Tests manuels + Playwright sur parcours login, dashboard, API, console clean.

A faire:

- Finaliser login/register/session/logout.
- Ajouter validations Zod sur toutes les routes.
- Ecrire README anglais au fil de l'eau.
- Ajouter un seed demo pour ne pas dependre d'un site externe pendant l'eval.

Sources: `en.subject.pdf` pages 9-10 et 28-30,
[Zod](https://zod.dev/),
[Playwright browsers](https://playwright.dev/docs/browsers).

## Framework frontend + backend - 2 pts

Minimum sujet: framework frontend et framework backend. Les full-stack
frameworks comptent pour les deux si les deux capacites sont utilisees.

Direction recommandee: Next.js App Router pour frontend + backend via Route
Handlers. Le service FastAPI reste un second backend specialise.

A faire:

- Garder les API routes Next pour auth/public API/notifications.
- Documenter clairement que Next.js est utilise cote UI et cote serveur.
- Documenter FastAPI comme microservice d'analyse.

Owner: elhirond pour UI, amoureau pour routes backend.

Sources: `en.subject.pdf` page 13,
[Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers),
[FastAPI](https://fastapi.tiangolo.com/).

## ORM - 1 pt

Minimum sujet: utiliser un ORM pour la base.

Direction recommandee: Prisma avec PostgreSQL. C'est deja en place, type-safe,
et coherent avec Next.js.

A faire:

- Etendre `schema.prisma`: users, sessions/accounts si Auth.js, assets,
  watchlists, comments, sources, analysis jobs, reports, notifications, api keys,
  user events.
- Demarrer simple: `User` + `Analysis` pour commencer, ajouter
  `Asset` evite de recopier le symbole et le nom dans chaque analyse.
- Ajouter migrations propres, eviter `db push --accept-data-loss` hors dev.

Owner: zalemu.

Sources: [Prisma + Next.js](https://www.prisma.io/docs/guides/nextjs),
[Prisma PostgreSQL](https://docs.prisma.io/docs/v6/orm/overview/databases/postgresql).

## Backend microservices - 2 pts

Minimum sujet: services backend faiblement couples, interfaces claires, REST API
ou queues, chaque service a une responsabilite unique.

Direction recommandee:

- `web`: auth, UI backend, public API, DB writes via Prisma.
- `analysis`: scraping, sentiment, indicateurs, recommendation ML, RAG.
- Communication REST interne: `web -> analysis`.
- Stocker jobs et resultats dans Postgres pour garder une source de verite.

Alternatives moins interessantes:

- Decouper en 4 microservices: trop lourd pour l'evaluation.
- Dire que Next + DB = microservices: trop faible, risque de refus.
- Queue Redis/Celery tout de suite: utile mais complexifie; a ajouter seulement
  si les analyses longues bloquent.

A faire:

- Ajouter endpoints FastAPI: `/analyze`, `/sentiment`, `/recommendations`,
  `/sources/fetch`, `/health`.
- Ajouter contrat JSON documente entre `web` et `analysis`.
- Logger chaque job avec statut `queued/running/succeeded/failed`.

Owners: mathboys + amoureau.

Sources: `en.subject.pdf` page 20,
[FastAPI bigger applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/),
[FastAPI OpenAPI docs](https://fastapi.tiangolo.com/tutorial/metadata/).

## Data scraping et emotion

Ce n'est pas un module seul dans votre liste, mais c'est le coeur produit et il
alimente analytics, ML, RAG et recommendation.

Direction recommandee:

- API officielle ou flux public en premier.
- Scraping HTML avec HTTPX/pandas si page simple.
- Playwright seulement si la page est rendue en JS/canvas.
- Toujours stocker source URL, date, texte brut nettoye, score emotion, erreurs.

Alternatives moins interessantes:

- Scraper des graphes visuels en image: fragile et difficile a expliquer.
- Appeler les sources a chaque refresh: lent, instable, risque demo.
- Ignorer ToS/robots/rate limit: risque technique et ethique.

A faire:

- Definir 2-3 sources maximum pour MVP.
- Implementer cache DB + seed local.
- Normaliser les commentaires en `source_comments`.
- Ajouter disclaimer "educational only, not financial advice".

Owner: mathboys, support zalemu.

Sources: [HTTPX](https://www.python-httpx.org/),
[pandas read_html](https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.read_html.html),
[Playwright browsers](https://playwright.dev/docs/browsers).

## Analytics dashboard avance - 2 pts

Minimum sujet: graphiques interactifs, updates temps reel, export, date ranges,
filtres.

Direction recommandee: Apache ECharts pour line/bar/pie et charts financiers,
TanStack Query pour cache client et refresh, endpoint export CSV/JSON au debut.

Alternatives moins interessantes:

- Recharts: plus simple, mais moins riche pour finance avancee.
- Plotly: puissant mais plus lourd visuellement et en bundle.
- Chart statique: ne valide pas "advanced".

A faire:

- Vue principale: courbe prix, volume, sentiment timeline, trend score.
- Filtres: symbole, periode, source, sentiment, horizon.
- Export: CSV/JSON minimum, PDF seulement si temps.
- Etat loading/error/empty propre.

Owners: mathboys + elhirond.

Sources: `en.subject.pdf` page 20,
[Apache ECharts](https://echarts.apache.org/handbook/en/get-started/),
[TanStack Query](https://tanstack.com/query/latest/docs/react/).

## Real-time WebSocket/SSE - 2 pts

Minimum sujet: updates temps reel entre clients, deconnexion/reconnexion,
broadcast efficace.

Direction recommandee: SSE pour le coeur du projet.

Pourquoi SSE:

- Suffisant pour notifications, statut de job, refresh dashboard.
- Plus simple que WebSocket dans Next.js.
- Reconnexion native cote navigateur avec `EventSource`.

Quand utiliser WebSocket/Socket.IO:

- Chat bidirectionnel.
- Presence/typing indicators.
- Collaboration live.

Alternatives moins interessantes:

- Polling toutes les 2 secondes: plus simple mais moins defendable comme temps
  reel.
- Socket.IO des le debut: trop lourd si aucun chat n'est fait.

A faire:

- Endpoint `/api/events` en `text/event-stream`.
- Events: `notification.created`, `analysis.updated`, `watchlist.updated`.
- Cote UI: hook `useEventSource`, reconnexion, fallback manuel "refresh".

Owner: amoureau, support elhirond.

Sources: `en.subject.pdf` page 13,
[MDN SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events),
[MDN WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket),
[Socket.IO](https://socket.io/docs/v4/).

## Public API securisee - 2 pts

Minimum sujet: API publique DB avec API key securisee, rate limiting,
documentation, au moins 5 endpoints, GET/POST/PUT/DELETE.

Direction recommandee:

- Prefixe `/api/public/v1`.
- API keys hash en DB, affichees une seule fois.
- Rate limit simple en Postgres par key + minute.
- Documentation OpenAPI en `/api/public/v1/openapi.json`.

Endpoints MVP:

- `GET/POST/PUT/DELETE /watchlists`
- `GET/POST/PUT/DELETE /notifications`
- `GET /assets`
- `GET /reports`

Alternatives moins interessantes:

- API key en clair en DB: mauvaise securite.
- Rate limit en memoire: fragile si plusieurs containers.
- Swagger UI complet des le debut: utile, mais OpenAPI JSON suffit pour commencer.

A faire:

- Table `api_keys`.
- Middleware/helper `requireApiKey`.
- Reponses d'erreur standardisees.
- Exemples curl dans README.

Owner: amoureau, support zalemu.

Sources: `en.subject.pdf` page 13,
[OpenAPI Specification](https://spec.openapis.org/oas/latest),
[Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers).

## Advanced search - 1 pt

Minimum sujet: filtres, tri, pagination.

Direction recommandee: recherche Postgres via Prisma pour assets, reports,
comments et notifications. Rester simple: `q`, `sort`, `page`, `limit`,
`dateFrom`, `dateTo`, `sentiment`, `source`.

Alternatives moins interessantes:

- Elasticsearch juste pour search: trop lourd et reserve au tampon ELK.
- Search uniquement frontend: ne passe pas la pagination/tri robuste.

A faire:

- Endpoint `/api/search`.
- Index DB sur `symbol`, `createdAt`, `sentiment`, relations utiles.
- UI search avec filtres visibles et pagination.

Owner: zalemu, support elhirond.

Sources: `en.subject.pdf` page 14,
[Prisma filtering and sorting](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting),
[PostgreSQL indexes](https://www.postgresql.org/docs/17/indexes.html).

## Recommendation ML - 2 pts -> j'ai des doutes sur ce point

Minimum sujet: recommendations personnalisees selon comportement utilisateur,
collaborative filtering ou content-based filtering, amelioration continue.

Direction recommandee: content-based filtering avec scikit-learn, car le projet
n'aura pas assez d'utilisateurs pour du vrai collaboratif.

Features utiles:

- Interactions: vues, ajouts watchlist, suppressions, exports, clics source.
- Features asset: sentiment moyen, volatilite, tendance, secteur si disponible,
  sources recentes.
- Reco: "assets/commentaires/rapports similaires a ce que l'utilisateur suit".

Alternatives moins interessantes:

- Collaborative filtering pur: pas assez de donnees au debut.
- LLM qui invente des recommendations: difficile a evaluer comme ML.
- Top assets globaux: pas personnalise, risque de refus.

A faire:

- Table `user_events`.
- Endpoint FastAPI `/recommendations/{userId}`.
- Modele `NearestNeighbors` ou similarite cosinus.
- Rebuild a chaque nouveau batch ou action utilisateur importante.
- Afficher "why recommended".

Owner: mathboys, support zalemu.

Sources: `en.subject.pdf` page 16,
[scikit-learn Nearest Neighbors](https://scikit-learn.org/stable/modules/neighbors.html),
[scikit-learn text features](https://scikit-learn.org/stable/modules/feature_extraction.html).

## Notifications CRUD - 1 pt

Minimum sujet: systeme complet de notifications pour toutes les actions create,
update, delete.

Direction recommandee: notifications DB + SSE.

Scope MVP:

- Watchlist created/updated/deleted.
- Analysis report created/failed.
- API key created/revoked.
- Data import/export done.

Alternatives moins interessantes:

- Toasts frontend non persistants: ne suffit pas.
- Service externe type Novu: trop lourd pour le besoin.

A faire:

- Table `notifications`: userId, type, entityType, entityId, title, body,
  readAt, createdAt.
- CRUD: list, mark read, update status, delete.
- Creation automatique dans les mutations principales.
- Notification center dans le dashboard.

Owner: amoureau, support elhirond.

Sources: `en.subject.pdf` page 13,
[MDN SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events).

## OAuth 2.0 - 1 pt

Minimum sujet: remote authentication via OAuth 2.0, par exemple Google, GitHub,
42.

Direction recommandee: Auth.js avec Prisma Adapter. GitHub et Google sont
standards; 42 peut etre configure comme provider OAuth custom.

Alternatives moins interessantes:

- Coder les 3 flows OAuth a la main: possible mais long et source de bugs.
- Faire un seul provider mal fini: moins impressionnant, mais suffisant pour le
  point si robuste.

A faire:

- Decider si on migre auth email/password vers Auth.js aussi.
- Ajouter tables `Account`, `Session`, `VerificationToken` si Auth.js.
- Variables `.env.example`: client id/secret 42, GitHub, Google.
- Relier compte OAuth a `User.email` si possible.

Owner: amoureau, support elhirond.

Sources: `en.subject.pdf` page 15,
[Auth.js](https://authjs.dev/),
[Prisma Auth.js guide](https://docs.prisma.io/docs/guides/authentication/authjs/nextjs),
[42 OAuth flow](https://api.intra.42.fr/apidoc/guides/web_application_flow),
[GitHub OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps),
[Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).

## 3 langues - 1 pt

Minimum sujet: i18n, 3 traductions completes, switcher UI, tout texte
user-facing traduisible.

Direction recommandee: `next-intl` avec JSON `en`, `fr`, `es`.

Alternatives moins interessantes:

- Traductions hardcodees dans composants: dette immediate.
- Russe si personne ne relit: risque UI et texte approximatif.
- Allemand: faisable, mais libelles plus longs a tester.

A faire:

- Extraire tous les textes UI vers `messages/{locale}.json`.
- Ajouter switcher langue dans user menu.
- Tester les layouts avec textes longs.
- README: lister les 3 langues et comment tester.

Owner: elhirond, support tous.

Sources: `en.subject.pdf` page 14,
[Next.js i18n guide](https://nextjs.org/docs/app/guides/internationalization),
[next-intl App Router](https://next-intl.dev/docs/getting-started/app-router).

## Design system 10 composants - 1 pt

Minimum sujet: design system custom avec composants reutilisables, palette,
typographie, icones, minimum 10 composants.

Direction recommandee: composants maison avec Tailwind CSS, CSS variables et
lucide-react pour icones.

Composants MVP:

1. Button
2. Input
3. Select
4. SegmentedControl
5. Modal
6. DropdownMenu
7. Tooltip
8. MetricTile
9. ChartPanel
10. NotificationItem
11. DataTable
12. LanguageSwitcher

Alternatives moins interessantes:

- MUI/Chakra seulement: rapide, mais moins "custom-made".
- shadcn complet: utile, mais il faut pouvoir expliquer ce qui est custom.

A faire:

- Dossier `web/src/components/ui`.
- Tokens dans `globals.css`.
- Page ou section de demo interne si temps.
- Pas de textes overflow, responsive verifie.

Owner: elhirond.

Sources: `en.subject.pdf` page 13,
[Tailwind + Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs),
[Lucide](https://lucide.dev/),
[Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction).

## Navigateurs additionnels - 1 pt

Minimum sujet: compatibilite complete avec au moins 2 navigateurs additionnels,
limitations documentees.

Direction recommandee: tester Chrome obligatoire + Firefox + Edge. Ajouter
WebKit/Safari si une machine Mac est disponible.

Alternatives moins interessantes:

- Declarer Safari via WebKit Linux seulement: utile, mais pas exactement Safari.
- Tests manuels sans checklist: difficile a defendre.

A faire:

- Playwright projects: chromium, firefox, webkit.
- Checklist manuelle: login, dashboard, charts, SSE, i18n, public API docs.
- Corriger CSS incompatibles.
- Documenter limitations dans README.

Owner: elhirond, support tous.

Sources: `en.subject.pdf` page 14,
[Playwright browsers](https://playwright.dev/docs/browsers).

## Health/status/backups/DR - 1 pt

Minimum sujet: health checks, status page, backups automatises, procedures de
disaster recovery.

Direction recommandee: etendre l'existant (`make backup`, health routes) avec
une page `/status` et un script restore teste.

Alternatives moins interessantes:

- Backup manuel non documente: pas assez demonstrable.
- Monitoring complet Prometheus ici: c'est un autre module.

A faire:

- `/api/health`: web, db, analysis, timestamp.
- `/status`: UI simple accessible admin ou publique.
- `make backup` garde dump date.
- `make restore BACKUP=...` ou doc procedure testee.
- README: RPO/RTO simplifie, ou au moins "how to restore".

Owner: zalemu, support amoureau.

Sources: `en.subject.pdf` page 20,
[PostgreSQL backup and restore](https://www.postgresql.org/docs/17/backup.html),
[pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html).

## RAG complet - 2 pts tampon probable

Minimum sujet: RAG complet, interaction avec dataset large, questions
utilisateur, retrieval pertinent, generation de reponse.

Direction recommandee:

- Stocker documents: articles, commentaires, rapports, sources scrapees.
- Chunk + embeddings dans Postgres via pgvector.
- Retriever top-k documents par question/symbole/horizon.
- Generer une reponse citee: "sources used", pas de conseil financier.

Packages:

- `pgvector` pour rester dans Postgres.
- `sentence-transformers` pour embeddings locaux si possible.
- LangChain seulement si cela accelere vraiment le wiring.

Alternatives moins interessantes:

- Chroma: bon outil, mais ajoute un service en plus.
- RAG sans citations: difficile a defendre.
- RAG sans LLM/fallback generation: risque de ne pas sembler complet.

A faire:

- Ajouter image Postgres avec pgvector si retenu.
- Table `documents`, `document_chunks`, `embeddings`.
- Endpoint `/rag/query`.
- UI: question libre sur un symbole + sources citees.

Owner: mathboys, support zalemu.

Sources: `en.subject.pdf` page 16,
[LangChain RAG](https://docs.langchain.com/oss/python/langchain/rag),
[pgvector](https://github.com/pgvector/pgvector),
[Hugging Face sentence transformers](https://huggingface.co/docs/hub/sentence-transformers).

## Standard user management - 2 pts surplus

Minimum sujet: update profil, avatar, friends, online status, page profil.

Direction recommandee: ne le faire que si vous voulez aussi preparer
User interaction/chat. Sinon, cout eleve pour un produit finance.

Alternatives moins interessantes:

- Profil sans friends/online: incomplet.
- Avatar sans validation type/taille: risque securite.

A faire:

- Profile page `/users/[id]`.
- Update display name, bio, avatar.
- Friend requests.
- Heartbeat online status.

Owner possible: amoureau + elhirond.

Sources: `en.subject.pdf` page 15.

## User activity analytics - 1 pt surplus

Correction: dans le sujet, ce module est minor 1 pt.

Direction recommandee: si Recommendation ML est fait, presque tout existe deja
via `user_events`. Ajouter une page admin/user insights.

A faire:

- Event tracking: login, search, view report, add watchlist, export.
- Dashboard: actions par jour, symboles consultes, recommendations clicked.

Alternatives moins interessantes:

- Google Analytics externe: moins coherent avec evaluation et donnees perso.

Sources: `en.subject.pdf` page 15.

## 2FA complet - 1 pt surplus

Minimum sujet: systeme 2FA complet.

Direction recommandee: TOTP avec secret chiffre/hashable selon besoin, QR code,
backup codes, disable flow.

Alternatives moins interessantes:

- Email OTP: moins standard et demande email fiable.
- WebAuthn: excellent mais plus long a bien faire.

A faire:

- `otplib` pour TOTP.
- `qrcode` pour provisioning URI.
- Backup codes haches.
- Enforce 2FA au login si active.

Sources: `en.subject.pdf` page 15,
[RFC 6238 TOTP](https://www.rfc-editor.org/rfc/rfc6238),
[otplib](https://www.npmjs.com/package/otplib),
[qrcode](https://www.npmjs.com/package/qrcode).

## SSR - 1 pt surplus

Minimum sujet: SSR pour performance et SEO.

Direction recommandee: page publique SSR par asset ou rapport, par exemple
`/market/[symbol]` ou `/reports/[id]/public`, rendue cote serveur avec donnees
Prisma.

Alternatives moins interessantes:

- Dire "Next fait SSR par defaut" sans page demonstrable: fragile.
- SSR dashboard auth complet: possible, mais plus complexe avec charts client.

A faire:

- Page non client-only.
- Metadata dynamique.
- Capture avant/apres ou explication README.

Sources: `en.subject.pdf` page 13,
[Next.js SSR](https://nextjs.org/docs/pages/building-your-application/rendering/server-side-rendering),
[Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components).

## User interaction chat/profils/amis - 2 pts surplus

Minimum sujet: chat basic, profile system, friends add/remove/list.

Direction recommandee: seulement si Standard user management est deja fait.
Utiliser WebSocket/Socket.IO pour chat et presence.

Alternatives moins interessantes:

- Chat via polling: moins propre pour module interaction temps reel.
- Chat externe embed: ne demontre pas votre implementation.

A faire:

- Tables `friendships`, `conversations`, `messages`.
- Socket server ou endpoint WebSocket dedie.
- UI chat minimal + friends list.

Sources: `en.subject.pdf` page 13,
[Socket.IO](https://socket.io/docs/v4/),
[MDN WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket).

## WCAG 2.1 AA complet - 2 pts surplus

Minimum sujet: conformite WCAG 2.1 AA, screen reader, keyboard navigation,
assistive tech.

Avis: tres noble, mais risquee. A ne prendre que si le frontend est stable et
si quelqu'un accepte une vraie passe manuelle.

Direction recommandee:

- Semantique HTML, contrastes, labels, focus visible, navigation clavier.
- Tests Playwright + axe pour detecter une partie des problemes.
- Checklist manuelle screen reader.

Alternatives moins interessantes:

- Se fier uniquement a axe: insuffisant pour "complete compliance".

Sources: `en.subject.pdf` page 14,
[W3C WCAG overview](https://www.w3.org/WAI/standards-guidelines/wcag/),
[Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing).

## Advanced permissions - 2 pts surplus

Minimum sujet: CRUD users, roles admin/user/guest/moderator, vues/actions selon
role.

Direction recommandee: role enum simple au debut: `USER`, `ADMIN`, `ANALYST`.
Ajouter policy helpers cote serveur.

Alternatives moins interessantes:

- CASL/permission engine complet: puissant mais trop lourd pour peu de roles.
- Controle uniquement dans l'UI: insuffisant, il faut serveur aussi.

A faire:

- Table/enum roles.
- Admin users CRUD.
- Middleware `requireRole`.
- UI admin separee.

Sources: `en.subject.pdf` page 15,
[Prisma authorization patterns](https://www.prisma.io/docs/orm/prisma-client/client-extensions/shared-extensions/row-level-security).

## Prometheus + Grafana - 2 pts surplus

Minimum sujet: Prometheus collecte metrics, exporters/integrations, dashboards
Grafana custom, alerting, acces securise.

Avis: interessant mais lourd en containers et memoire. A garder apres 19 pts
fonctionnels.

Direction recommandee:

- `/metrics` pour web et analysis.
- Prometheus scrape les services.
- Grafana provisionne datasource + dashboard JSON.

Alternatives moins interessantes:

- Dashboard Grafana vide: refus probable.
- Metrics uniquement Docker generiques: pas assez applicatif.

A faire:

- Ajouter services `prometheus` et `grafana` dans compose.
- Metrics: request count, latency, analysis jobs, failed jobs, API rate limit.
- Dashboard versionne.

Sources: `en.subject.pdf` page 20,
[Prometheus getting started](https://prometheus.io/docs/prometheus/latest/getting_started/),
[Grafana dashboards](https://grafana.com/docs/grafana/latest/dashboards/),
[Grafana provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/).

## ELK logs - 2 pts surplus

Minimum sujet: Elasticsearch stocke/indexe, Logstash collecte/transforme,
Kibana visualise, retention/archiving, acces securise.

Avis: encore plus lourd que Prometheus/Grafana. Utile seulement si l'equipe a
beaucoup de temps.

Direction recommandee:

- Logs JSON depuis web/analysis/nginx.
- Filebeat ou Logstash lit les logs Docker.
- Elasticsearch indexe, Kibana dashboard erreurs et latence.

Alternatives moins interessantes:

- Juste `docker logs`: ne valide pas ELK.
- Ajouter Elasticsearch pour search produit: melange les objectifs.

A faire:

- Standardiser logs JSON.
- Services elasticsearch/logstash/kibana.
- Retention policy simple.
- Dashboard Kibana erreurs 4xx/5xx et jobs fails.

Sources: `en.subject.pdf` page 19,
[Elastic Stack getting started](https://www.elastic.co/guide/en/elastic-stack-get-started/index.html),
[Filebeat Docker](https://www.elastic.co/docs/reference/beats/filebeat/running-on-docker),
[Docker logging](https://docs.docker.com/engine/logging/).

## Schema DB initial recommande

Principe: commencer avec peu de tables, mais eviter une table `analysis` qui
contient tout. Le minimum robuste est `User`, `Asset`, `Analysis`, `Watchlist`,
`Notification`. Les sources, candles et events peuvent arriver juste apres.

MVP ORM:

| Table | Role | Champs importants |
|---|---|---|
| `users` | Compte applicatif | `id`, `email`, `passwordHash`, `name`, `role`, `createdAt`, `updatedAt` |
| `assets` | Action/crypto suivie | `id`, `symbol`, `name`, `lastPrice`, `dayChangePercent` |
| `watchlists` | Liste utilisateur | `id`, `userId`, `name`, `createdAt` |
| `watchlist_items` | Assets dans une watchlist | `id`, `watchlistId`, `assetId`, `createdAt` |
| `analyses` | Analyse d'un asset pour un user | `id`, `userId`, `assetId`, `status`, `horizon`, `trendLabel`, `recommendation`, `technicalScore`, `emotionScore`, `confidenceScore`, `summary`, `error`, `startedAt`, `completedAt` |
| `analysis_sources` | Sources utilisees par analyse | `id`, `analysisId`, `kind`, `url`, `title`, `publishedAt`, `excerpt` |
| `notifications` | Notifications CRUD | `id`, `userId`, `type`, `entityType`, `entityId`, `title`, `body`, `readAt`, `createdAt` |
| `api_keys` | Public API securisee | `id`, `userId`, `name`, `keyHash`, `prefix`, `lastUsedAt`, `revokedAt` |
| `user_events` | ML et analytics utilisateur | `id`, `userId`, `type`, `assetId`, `metadata`, `createdAt` |

Relations essentielles:

- `User` possede des `Watchlist`, `Analysis`, `Notification`, `ApiKey`,
  `UserEvent`.
- `Asset` est reference par `WatchlistItem`, `Analysis`, `UserEvent`.
- `Analysis` reference un `Asset`, l'utilisateur qui l'a demandee, et ses
  `AnalysisSource`.

Enums utiles:

- `Role`: `USER`, `ADMIN`, `ANALYST`.
- `AnalysisStatus`: `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`.
- `TrendLabel`: `BULLISH`, `NEUTRAL`, `BEARISH`.
- `RecommendationLabel`: `BUY`, `HOLD`, `SELL`, `WATCH`.
- `SourceKind`: `PRICE`, `COMMENT`, `NEWS`, `API`, `SCRAPE`.

Extensions apres MVP:

- `price_candles` pour stocker les courbes historiques.
- `source_comments` si les commentaires deviennent un dataset a part.
- `recommendations` si on veut historiser les sorties du modele ML.
- `auth accounts/sessions` si Auth.js est adopte.
- `document_chunks` + `embeddings` ou colonne vector via pgvector si RAG.

Draft Prisma compact:

```prisma
enum Role {
  USER
  ADMIN
  ANALYST
}

enum AnalysisStatus {
  QUEUED
  RUNNING
  SUCCEEDED
  FAILED
}

enum TrendLabel {
  BULLISH
  NEUTRAL
  BEARISH
}

enum RecommendationLabel {
  BUY
  HOLD
  SELL
  WATCH
}

enum SourceKind {
  PRICE
  COMMENT
  NEWS
  API
  SCRAPE
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String?
  role         Role     @default(USER)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  analyses     Analysis[]
  watchlists   Watchlist[]
  notifications Notification[]
  apiKeys      ApiKey[]
  events       UserEvent[]

  @@map("users")
}

model Asset {
  id        String   @id @default(uuid())
  symbol    String   @unique
  name      String
  lastPrice Float?
  createdAt DateTime @default(now())

  analyses Analysis[]
  items    WatchlistItem[]
  events   UserEvent[]

  @@map("assets")
}

model Analysis {
  id              String              @id @default(uuid())
  userId          String
  assetId         String
  status          AnalysisStatus      @default(QUEUED)
  horizon         String              @default("short")
  trendLabel      TrendLabel?
  recommendation  RecommendationLabel?
  technicalScore  Float?
  emotionScore    Float?
  confidenceScore Float?
  summary         String?
  error           String?
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  user    User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  asset   Asset            @relation(fields: [assetId], references: [id], onDelete: Cascade)
  sources AnalysisSource[]

  @@index([userId, createdAt])
  @@index([assetId, createdAt])
  @@map("analyses")
}

model AnalysisSource {
  id          String     @id @default(uuid())
  analysisId  String
  kind        SourceKind
  url         String?
  title       String?
  publishedAt DateTime?
  excerpt     String?
  createdAt   DateTime   @default(now())

  analysis Analysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)

  @@index([analysisId])
  @@map("analysis_sources")
}

model Watchlist {
  id        String   @id @default(uuid())
  userId    String
  name      String   @default("Default")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user  User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  items WatchlistItem[]

  @@index([userId])
  @@map("watchlists")
}

model WatchlistItem {
  id          String   @id @default(uuid())
  watchlistId String
  assetId     String
  createdAt   DateTime @default(now())

  watchlist Watchlist @relation(fields: [watchlistId], references: [id], onDelete: Cascade)
  asset     Asset     @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@unique([watchlistId, assetId])
  @@map("watchlist_items")
}

model Notification {
  id         String    @id @default(uuid())
  userId     String
  type       String
  entityType String?
  entityId   String?
  title      String
  body       String?
  readAt     DateTime?
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, readAt])
  @@map("notifications")
}

model ApiKey {
  id         String    @id @default(uuid())
  userId     String
  name       String
  keyHash    String
  prefix     String
  lastUsedAt DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([keyHash])
  @@index([userId])
  @@map("api_keys")
}

model UserEvent {
  id        String   @id @default(uuid())
  userId    String
  assetId   String?
  type      String
  metadata  Json?
  createdAt DateTime @default(now())

  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  asset Asset? @relation(fields: [assetId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@index([assetId])
  @@map("user_events")
}
```
