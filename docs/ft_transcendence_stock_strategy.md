# Strategie ft_transcendence - projet analyse de tendance d'action

Source lue : `en.subject.pdf`, version 21.1, projet `ft_transcendence Surprise`.

## 1. Ce que demande le sujet

Le projet n'impose plus Pong. L'application est libre, mais elle doit etre une vraie application web avec :

- un frontend ;
- un backend ;
- une base de donnees ;
- un deploiement containerise lanceable en une commande ;
- une compatibilite Chrome stable, sans erreur ni warning console ;
- des pages Privacy Policy et Terms of Service accessibles et non vides ;
- plusieurs utilisateurs connectes en meme temps ;
- une authentification email/password securisee ;
- validation des entrees cote frontend et backend ;
- HTTPS entre le navigateur et le backend ;
- un `README.md` complet en anglais.

Scoring :

- 14 points de modules valides sont requis pour terminer le projet.
- 1 major = 2 points.
- 1 minor = 1 point.
- Les bonus ne comptent qu'une fois les 14 points requis valides.
- Le bonus maximum est de 5 points.
- Donc l'objectif "full bonus" correspond a 19 points valides.

Point important : il vaut mieux viser 20 ou 21 points implementes pour absorber un module refuse pendant l'evaluation, meme si le bonus effectif est cappe a 5 points.

## 2. Avis sur l'idee produit

L'idee est coherente avec le sujet : une interface web qui collecte des informations sur une action, affiche les courbes, interprete des indicateurs techniques, puis produit une tendance haussiere/neutre/baissiere via une couche IA/sentiment.

Le projet peut etre presente comme un dashboard d'aide a l'analyse, pas comme un outil de conseil financier. C'est important pour les Terms of Service et pour l'evaluation : l'application explique ses signaux, cite ses sources et affiche une limite claire du type "educational/demo purpose, not financial advice".

Je recommande d'eviter le scraping sauvage comme base principale. Pour aller vite et rester defendable :

- privilegier une API de donnees financieres, flux RSS, ou sources ouvertes avec conditions d'utilisation claires ;
- garder le "scraping" comme connecteur limite, rate-limite, cache, avec user-agent explicite ;
- stocker les donnees collectees pour eviter de rappeler les sources a chaque refresh ;
- tracer les sources utilisees pour chaque analyse.

## 3. Stack recommandee

### Option la plus rapide a faire valider

- Frontend : React + Vite + TypeScript, donc TypeScript/JavaScript cote navigateur.
- UI/styling : Tailwind CSS, MUI, ou Chakra. MUI accelere les formulaires/tableaux ; Tailwind donne plus de controle visuel.
- Backend : Python avec Django + Django REST Framework.
- DB : PostgreSQL, donc SQL pour les requetes, les migrations et les contraintes relationnelles.
- Jobs asynchrones : Celery + Redis, donc Python pour les workers et Redis comme broker/cache.
- Graphiques : Apache ECharts, Recharts ou Plotly, donc TypeScript/JavaScript dans le frontend.
- IA : endpoint backend Python qui appelle un LLM externe ou un modele local selon vos contraintes.
- Containers : Docker Compose avec `frontend`, `backend`, `postgres`, `redis`, reverse proxy HTTPS.

Pourquoi Django plutot que FastAPI pour aller vite :

- auth, hash password, migrations, ORM, admin, permissions et formulaires sont deja tres balises ;
- l'ORM donne un minor presque naturellement ;
- les permissions/admin aident pour le major "Advanced permissions";
- DRF facilite l'API publique securisee.

FastAPI reste un bon choix si l'equipe est tres a l'aise avec l'async, les WebSockets et Pydantic. Par contre, il faudra coder plus de choses a la main : auth, roles, admin, migrations, gestion user.

### Langages et versions conseillees par categorie

Versions verifiees le 2026-05-02. L'objectif n'est pas d'utiliser la nouveaute absolue partout, mais de choisir des versions stables, supportees, faciles a expliquer en evaluation et compatibles entre elles.

| Categorie | Langage principal | Version conseillee | Technologies concretes | Pourquoi |
|---|---|---:|---|---|
| Frontend app | TypeScript + JavaScript | TypeScript 6.0.x, Node.js 24.x LTS | React 19.2.x, Vite 8.x | TypeScript limite les erreurs UI/API ; Node 24 est LTS ; React 19.2 est la version courante documentee ; Vite 8 donne un setup rapide et moderne. |
| UI / CSS | CSS + TypeScript | Tailwind CSS 4.x | `tailwindcss`, `@tailwindcss/vite` | Tailwind 4 avec Vite est rapide a installer, peu verbeux, et suffisant pour valider la contrainte de styling solution. |
| Graphiques financiers | TypeScript + JavaScript | Apache ECharts 6.x | `echarts`, wrapper React si besoin | ECharts 6 annonce des ameliorations orientees graphiques complexes et trading charts ; meilleur fit pour courbes, volumes, MACD, overlays. |
| Backend API | Python | Python 3.13.x recommande, 3.14.x possible | Django 5.2.x LTS, Django REST Framework 3.17.x | Python est le meilleur choix pour calcul/data/IA ; Django 5.2 est LTS ; DRF 3.17 supporte Django 6/Python 3.14 mais reste compatible avec Django 5.2. |
| Auth / permissions | Python + SQL | Meme stack backend | Django auth, permissions, sessions/JWT | Le sujet demande auth email/password securisee ; Django evite de recoder hashing, migrations, validations et permissions de base. |
| Donnees relationnelles | SQL | PostgreSQL 18.x ou 17.x | PostgreSQL, migrations Django | PostgreSQL est robuste pour relations users/assets/prices/news/reports ; 18.x est le dernier major, 17.x est acceptable si l'equipe veut rester plus conservatrice. |
| Calculs financiers | Python | Python 3.13.x | pandas/numpy optionnels, code Python pur possible | Les indicateurs SMA/RSI/volatilite sont plus simples a tester en Python ; pandas aide si les series deviennent volumineuses. |
| Collecte / scraping | Python | Python 3.13.x | `httpx`/`requests`, BeautifulSoup si besoin, API providers | Python est pratique pour connecteurs, nettoyage HTML/JSON, rate-limit et cache. Preferer API/RSS au scraping fragile. |
| IA / sentiment | Python | Python 3.13.x | SDK fournisseur LLM, appels HTTP, streaming SSE/WebSocket | Garder les clefs API cote backend ; Python facilite prompts, batching, retries, stockage et tests. |
| Jobs asynchrones | Python + Redis | Celery 5.6.x | Celery workers, Redis broker/cache | Les analyses IA et les imports peuvent etre longs ; les sortir des requetes HTTP evite une UX bloquee. |
| Temps reel | TypeScript + Python | WebSocket/SSE selon besoin | Django Channels ou SSE HTTP | Pour le major real-time, afficher statut de job, nouvelles analyses et notifications sans refresh manuel. |
| DevOps | YAML + Shell | Docker Compose v2 | Dockerfiles, Compose, reverse proxy HTTPS | Le sujet impose un lancement en une commande ; Compose reste le plus simple a expliquer et evaluer. |
| Tests backend | Python | pytest 8.x ou Django test runner | pytest, pytest-django, coverage | Tests rapides des endpoints, permissions, indicateurs et scoring. |
| Tests frontend | TypeScript | Vitest 3.x/4.x selon compat Vite | Vitest, Testing Library, Playwright optionnel | Vitest colle a Vite ; Playwright est utile pour verifier les parcours Chrome et la console propre. |
| Documentation | Markdown + Mermaid | Markdown standard | README, schema Mermaid/DBML | Le README est obligatoire en anglais ; Mermaid permet un schema DB lisible sans outil externe. |

### Pourquoi ces versions

- Python 3.13.x est le meilleur compromis : moderne, encore en bugfix, tres bien supporte par l'ecosysteme data/IA, et compatible avec Django 5.2 LTS. Python 3.14.x est officiellement disponible et supporte par Django/DRF recents, mais 3.13 reduit le risque de tomber sur une lib qui vient seulement d'ajouter le support 3.14.
- Django 5.2.x LTS est plus adapte qu'un Django 6.0 court terme pour un projet 42 : il reste supporte plus longtemps, change moins vite, et vous donne auth/ORM/admin/permissions sans repartir de zero.
- DRF 3.17.x est coherent avec Django 5.2 et laisse une marge si vous migrez plus tard vers Django 6.0.
- Node.js 24.x LTS est preferable a Node 25 Current pour un projet d'evaluation : les versions LTS sont celles recommandees pour la production.
- React 19.2.x est le bon choix pour un nouveau frontend en 2026 : pas de dette React 18, documentation courante, compatibilite avec les outils modernes.
- Vite 8.x est adapte parce que c'est le bundler stable courant, rapide, et simple a containeriser. Il evite la complexite d'un framework full-stack type Next.js si vous ne comptez pas claim SSR.
- TypeScript 6.0.x est un bon point d'equilibre : stable, moderne, et encore base sur la toolchain classique. Eviter TypeScript 7 beta/dev dans le chemin critique.
- PostgreSQL 18.x est le dernier major stable ; PostgreSQL 17.x est acceptable si vous privilegiez une base plus eprouvee. Dans tous les cas, pinnez l'image Docker.
- ECharts 6.x est le plus interessant pour ce projet parce que ses exemples et nouveautes ciblent explicitement des graphiques financiers/trading plus riches.

## 4. Decoupage de la partie mandatory pour ce projet

Estimation globale pour un MVP propre : environ 5 000 a 9 000 lignes applicatives hors dependances generees, selon finition UI, tests et choix framework.

| Sous-partie | Contenu minimal | Estimation lignes | Risque |
|---|---:|---:|---|
| Cadrage produit | Nom, scope, parcours utilisateur, limites "not financial advice" | 100-250 docs | Faible |
| Docker / lancement | `docker-compose`, env, reverse proxy, DB, migrations, seed | 150-400 | Moyen |
| HTTPS / env | certificats locaux, `.env`, `.env.example`, secrets ignores par Git | 80-200 | Moyen |
| Backend base | Django/DRF, settings, routing, serializers, erreurs API | 500-900 | Faible |
| Base de donnees | schema actions/prix/news/analyses/watchlists/users | 300-700 | Moyen |
| Auth obligatoire | email/password, hash/salt, sessions/JWT, validation | 300-700 avec Django | Moyen |
| Frontend base | layout responsive, navigation, pages auth, dashboard shell | 800-1 500 | Moyen |
| Collecte donnees | connecteurs market/news, cache, rate-limit, normalisation | 700-1 500 | Moyen/fort |
| Interpretation courbe | indicateurs simples : SMA, RSI, tendance, volatilite | 400-900 | Moyen |
| Sentiment / IA | analyse articles, prompt, score, explication, fallback erreurs | 500-1 100 | Moyen/fort |
| Dashboard | courbes, filtres date, detail sources, tendance finale | 700-1 500 | Moyen |
| Validation inputs | frontend + backend sur symboles, formulaires, API | 250-600 | Moyen |
| Privacy / Terms | pages accessibles, contenu adapte au projet | 150-350 docs/UI | Faible |
| README anglais | roles, stack, schema DB, modules, contributions, AI usage | 500-1 200 docs | Faible mais obligatoire |
| Tests / qualite | tests API, tests unitaires score, parcours navigateur | 500-1 200 | Moyen |

### MVP produit conseille

1. Un utilisateur cree un compte et se connecte.
2. Il cherche une action par symbole ou nom.
3. Il l'ajoute a une watchlist.
4. Le backend recupere prix historiques + actualites/textes associes.
5. Le backend calcule des indicateurs techniques.
6. Le backend lance une analyse IA/sentiment.
7. Le dashboard affiche :
   - courbe du prix ;
   - indicateurs ;
   - sentiment positif/neutre/negatif ;
   - tendance finale haussiere/neutre/baissiere ;
   - explication et sources.
8. L'utilisateur exporte un rapport CSV/JSON/PDF selon le module choisi.

Schema DB de depart :

- `users`, `profiles`, `roles`, `permissions`
- `assets` : symbole, nom, dernier prix, variation
- `price_candles` : asset, timestamp, open/high/low/close/volume
- `news_items` : asset, source, url, titre, texte nettoye, date publication
- `sentiment_runs` : news item ou batch, score, label, modele, cout, erreurs
- `technical_indicators` : asset, periode, indicateurs calcules
- `trend_reports` : asset, score technique, score sentiment, label final, explication
- `watchlists`, `watchlist_items`
- `api_keys`, `audit_events`, `exports`, `health_checks`

## 5. Tableau des modules avec difficulte et lignes estimees

Legende :

- Fit : Fort = naturel pour le projet ; Moyen = faisable mais a justifier ; Faible = peu coherent ; Non = a eviter.
- Difficulte : 1 tres simple, 5 tres risquee.
- Lignes : estimation incrementale, hors mandatory deja necessaire et hors tests exhaustifs.

| Categorie | Module | Type | Pts | Fit | Diff. | Lignes | Commentaire |
|---|---|---:|---:|---|---:|---:|---|
| Web | Framework frontend + backend | Major | 2 | Fort | 1 | 150-400 | A prendre. React + Django/DRF valide naturellement ce module. |
| Web | Framework frontend seul | Minor | 1 | Fort | 1 | 100-250 | Ne pas double-claim si vous prenez le major framework complet. |
| Web | Framework backend seul | Minor | 1 | Fort | 1 | 100-300 | Ne pas double-claim si vous prenez le major framework complet. |
| Web | Real-time features WebSocket/SSE | Major | 2 | Fort | 3 | 500-1 200 | Live refresh des analyses, jobs, prix, notifications. Tres coherent mais plus d'infra. |
| Web | User interaction chat/profiles/friends | Major | 2 | Moyen | 4 | 1 200-2 500 | Faisable, mais chat + friends alourdissent le projet finance. |
| Web | Public API securisee | Major | 2 | Fort | 2 | 500-1 000 | Excellent fit : endpoints assets, watchlists, reports, exports, API keys, rate-limit. |
| Web | ORM | Minor | 1 | Fort | 1 | 100-300 | Django ORM ou SQLAlchemy. Tres rentable. |
| Web | Notifications CRUD | Minor | 1 | Moyen | 2 | 400-900 | Notifications sur creation/update/delete de watchlist, rapport, import. |
| Web | Real-time collaborative features | Minor | 1 | Faible | 4 | 1 200-2 500 | Collaboration live de dashboards ; lourd pour 1 point. |
| Web | SSR | Minor | 1 | Faible | 3 | 400-1 000 | Pas naturel avec React SPA + Django. Next.js possible mais change la stack. |
| Web | PWA offline/installable | Minor | 1 | Moyen | 2 | 250-700 | Rentable si cache shell + derniers rapports. |
| Web | Design system 10 composants | Minor | 1 | Moyen | 2 | 500-1 100 | Utile si l'equipe frontend aime structurer ; attention au temps UI. |
| Web | Advanced search filtres/sort/pagination | Minor | 1 | Fort | 2 | 300-700 | Recherche actions/news/rapports. Tres coherent. |
| Web | File upload management | Minor | 1 | Moyen | 3 | 500-1 000 | Import CSV ou avatar ; utile mais moins prioritaire que export/search. |
| Access/i18n | WCAG 2.1 AA complet | Major | 2 | Moyen | 5 | 800-1 800 | Beau module mais validation exigeante. A eviter pour aller vite. |
| Access/i18n | 3 langues | Minor | 1 | Moyen | 2 | 400-1 000 | Possible si prevu au debut. Sinon couteux en fin de projet. |
| Access/i18n | RTL | Minor | 1 | Faible | 3 | 250-700 | Seulement si i18n deja propre. |
| Access/i18n | Navigateurs additionnels | Minor | 1 | Moyen | 2 | 100-500 | Peu de code, beaucoup de test manuel. |
| User | Standard user management | Major | 2 | Moyen/Fort | 3 | 700-1 500 | Profile, avatar, friends, online status. Rentable si vous acceptez le cote social. |
| User | Game statistics | Minor | 1 | Non | 3 | 500-1 100 | Depend d'un jeu. Hors sujet. |
| User | OAuth 2.0 | Minor | 1 | Moyen | 2 | 250-600 | 42/GitHub/Google. Bon point bonus, mais depend de credentials. |
| User | Advanced permissions | Major | 2 | Fort | 2 | 500-1 100 | Roles admin/user/analyst, CRUD users. Django aide beaucoup. |
| User | Organization system | Major | 2 | Fort | 3 | 700-1 400 | Workspaces/equipes qui partagent des watchlists. Coherent mais plus long. |
| User | 2FA complet | Minor | 1 | Moyen | 3 | 350-800 | Bon module securite, mais attention UX et recovery codes. |
| User | User activity analytics | Minor | 1 | Moyen | 3 | 500-1 100 | Dashboard d'activite utilisateur ; possible avec audit_events. |
| AI | AI opponent games | Major | 2 | Non | 4 | 1 000-2 000 | Depend d'un jeu. Hors sujet. |
| AI | RAG complet | Major | 2 | Moyen/Fort | 4 | 900-2 000 | Possible sur corpus de news/rapports, mais plus lourd que LLM simple. |
| AI | LLM interface complet | Major | 2 | Fort | 3 | 500-1 200 | A prendre : generation d'explication, streaming, erreurs, rate-limit. |
| AI | Recommendation ML | Major | 2 | Moyen | 5 | 1 000-2 200 | Recommander actions/articles. Risque data/ML eleve. |
| AI | Content moderation AI | Minor | 1 | Faible | 2 | 300-800 | Seulement si commentaires utilisateurs. |
| AI | Voice/speech integration | Minor | 1 | Faible | 4 | 600-1 400 | Pas prioritaire. |
| AI | Sentiment analysis user-generated content | Minor | 1 | Risque | 2 | 300-900 | Le wording dit "user-generated content". Pour news marche, mieux vaut custom minor ou inclure des commentaires utilisateurs. |
| AI | Image recognition/tagging | Minor | 1 | Non | 4 | 700-1 600 | Hors sujet. |
| Cyber | WAF/ModSecurity + Vault | Major | 2 | Faible | 5 | 800-1 800 | Gros cout ops, peu rentable pour aller vite. |
| Gaming | Web-based game | Major | 2 | Non | 5 | 1 500-3 000 | Hors sujet. |
| Gaming | Remote players | Major | 2 | Non | 5 | 1 000-2 000 | Depend d'un jeu. |
| Gaming | Multiplayer 3+ | Major | 2 | Non | 5 | 1 200-2 500 | Depend d'un jeu. |
| Gaming | Second game + matchmaking | Major | 2 | Non | 5 | 1 800-3 500 | Depend d'un jeu. |
| Gaming | Advanced 3D | Major | 2 | Faible | 5 | 1 200-2 800 | Possible visualisation 3D, mais pas rapide. |
| Gaming | Advanced chat | Minor | 1 | Faible | 3 | 600-1 200 | Depend du module user interaction/chat. |
| Gaming | Tournament system | Minor | 1 | Non | 3 | 600-1 200 | Depend d'un jeu. |
| Gaming | Game customization | Minor | 1 | Non | 2 | 300-800 | Depend d'un jeu. |
| Gaming | Gamification | Minor | 1 | Moyen | 3 | 600-1 300 | Badges/streaks d'analyse. Coherent mais pas si rapide. |
| Gaming | Spectator mode | Minor | 1 | Non | 3 | 500-1 000 | Depend d'un jeu. |
| DevOps | ELK logs | Major | 2 | Moyen | 4 | 700-1 600 config | Valable mais lourd en containers/memoire. |
| DevOps | Prometheus + Grafana | Major | 2 | Moyen | 4 | 600-1 300 config | Bon pour equipe DevOps, sinon pas le plus rapide. |
| DevOps | Backend microservices | Major | 2 | Moyen | 5 | 1 000-2 500 | Augmente fortement la complexite. |
| DevOps | Health/status/backups/DR | Minor | 1 | Fort | 2 | 200-600 | Tres bon minor : endpoint health, page status, backup DB, doc restore. |
| Data | Analytics dashboard avance | Major | 2 | Fort | 3 | 800-1 600 | A prendre : coeur du projet avec graphiques, filtres, exports, refresh. |
| Data | Export/import data | Minor | 1 | Fort | 2 | 300-700 | CSV/JSON pour watchlists et rapports. Bon rapport effort/point. |
| Data | GDPR compliance | Minor | 1 | Fort | 2 | 300-800 | Export/delete user data + confirmations. Coherent avec Privacy mandatory. |
| Blockchain | Tournament scores Avalanche | Major | 2 | Non | 5 | 1 200-2 500 | Depend de tournament/game. |
| Blockchain | ICP backend | Minor | 1 | Non | 5 | 900-2 000 | Incompatible SSR, trop eloigne du besoin. |
| Choice | Custom major | Major | 2 | Fort mais risque | 3 | 800-1 600 | Ex : pipeline collecte + scoring financier traceable. A justifier tres clairement. |
| Choice | Custom minor | Minor | 1 | Fort mais risque | 2 | 250-700 | Ex : alertes de seuil ou score de confiance. Bon module tampon si bien justifie. |

### Point de vigilance : major framework vs minors frontend/backend

Le sujet v21.1 ne dit pas explicitement : "si vous prenez le major framework frontend + backend, vous ne pouvez pas compter les deux minors frontend et backend".

Par contre, je recommande de ne pas baser le scoring dessus. Le major "Use a framework for both the frontend and backend" contient deja exactement les deux exigences des minors :

- utiliser un framework frontend ;
- utiliser un framework backend.

Le compter aussi comme deux minors reviendrait a obtenir 4 points pour la meme implementation technique, alors que le sujet valorise ce bloc a 2 points dans le major. Pour une evaluation 42, c'est typiquement le genre de double comptage qui peut etre refuse, meme si la phrase d'exclusion n'est pas ecrite mot pour mot.

Regle prudente a appliquer : choisir soit le major framework complet, soit les deux minors frontend/backend, mais ne pas compter les trois dans le total annonce. Si un evaluateur de votre campus confirme explicitement que le cumul est autorise, vous pourrez alors l'utiliser comme marge bonus, mais il ne doit pas etre dans le chemin critique vers 14 ou 19 points.

## 6. Combinaisons recommandees pour atteindre 19 points

### Combo A - recommande, 19 points exacts, coherent avec l'idee

Ce combo evite jeux, blockchain, gros DevOps et custom modules. Il utilise des modules listes, donc plus faciles a defendre.

Majors, 14 points :

| Module | Points | Pourquoi il colle |
|---|---:|---|
| Web - Framework frontend + backend | 2 | React + Django/DRF. |
| Web - Public API securisee | 2 | API pour assets, watchlists, reports, exports, API keys, rate-limit. |
| Web - Real-time features | 2 | Refresh des prix, statut des analyses IA, notifications live via WebSocket/SSE. |
| User - Standard user management | 2 | Profile, avatar, friends/following, online status. Peut servir a suivre d'autres analystes. |
| User - Advanced permissions | 2 | Roles admin/user/analyst, vues/actions differentes. |
| AI - LLM interface complet | 2 | Analyse textuelle, streaming, rate-limit, erreurs. |
| Data - Analytics dashboard avance | 2 | Graphiques interactifs, date ranges, exports, refresh. |

Minors, 5 points :

| Module | Points | Pourquoi il colle |
|---|---:|---|
| Web - ORM | 1 | Django ORM. |
| Web - Advanced search | 1 | Recherche actions/news/rapports avec filtres, tri, pagination. |
| Web - PWA | 1 | Dashboard installable, cache du shell et derniers rapports. |
| Data - Export/import | 1 | Export CSV/JSON des rapports et import watchlists. |
| DevOps - Health/status/backups | 1 | Page status, `/health`, backup Postgres, procedure restore. |

Total : 19 points.

Avantage : peu de modules artificiels, bon alignement avec le produit, bon ratio points/effort.

Risque : le real-time demande une implementation propre. Si vous voulez eviter WebSocket/SSE, prenez le combo B.

### Combo B - sans real-time majeur, 19 points exacts

Majors, 12 points :

- Web - Framework frontend + backend : 2
- Web - Public API securisee : 2
- User - Standard user management : 2
- User - Advanced permissions : 2
- AI - LLM interface complet : 2
- Data - Analytics dashboard avance : 2

Minors, 7 points :

- Web - ORM : 1
- Web - Advanced search : 1
- Web - Notifications CRUD : 1
- User - OAuth 2.0 : 1
- Data - Export/import : 1
- Data - GDPR compliance : 1
- DevOps - Health/status/backups : 1

Total : 19 points.

Avantage : pas de temps perdu sur WebSocket si l'equipe ne le sent pas.

Risque : plus de petits modules a demontrer, OAuth/GDPR/notifications doivent etre vraiment finis.

### Combo C - plus proche du produit finance collaboratif, 19 points exacts

Majors, 14 points :

- Web - Framework frontend + backend : 2
- Web - Public API securisee : 2
- Web - Real-time features : 2
- User - Advanced permissions : 2
- User - Organization system : 2
- AI - LLM interface complet : 2
- Data - Analytics dashboard avance : 2

Minors, 5 points :

- Web - ORM : 1
- Web - Advanced search : 1
- Data - Export/import : 1
- Data - GDPR compliance : 1
- DevOps - Health/status/backups : 1

Total : 19 points.

Avantage : tres coherent si le produit devient un dashboard d'equipe avec workspaces et roles.

Risque : organization system est plus long que des profils/friends basiques.

### Buffer conseille pour securiser le bonus

Si l'equipe a le temps, implementer 20 ou 21 points et garder un tampon :

- Custom minor : "financial source traceability and confidence score" : +1
- OAuth 2.0 si pas deja inclus : +1
- GDPR si pas deja inclus : +1
- PWA si pas deja inclus : +1

Je n'utiliserais pas un custom module dans le chemin critique vers 19, parce qu'il depend davantage de la justification et de l'humeur de l'evaluation. Je l'utiliserais plutot comme module tampon.

## 7. Comment presenter l'IA/sentiment a l'evaluation

Le module le plus defendable est "Complete LLM system interface", pas "Sentiment analysis for user-generated content".

Raison : le sujet precise "user-generated content" pour le minor sentiment. Des news scrapees ou des articles externes ne sont pas forcement du contenu genere par les utilisateurs de votre app. Pour eviter une discussion inutile :

- claim officiel : Major LLM interface ;
- feature produit : sentiment de marche sur articles/sources ;
- option tampon : custom minor/major si vous voulez faire valider le pipeline de scoring financier.

Implementation minimale defendable pour le major LLM :

- input utilisateur : symbole, horizon, sources selectionnees ;
- prompt construit cote backend ;
- streaming de reponse vers le frontend ;
- gestion des erreurs fournisseur ;
- rate limiting par utilisateur/API key ;
- stockage du resultat ;
- affichage de l'explication et des sources ;
- mention claire des limites.

## 8. Plan d'execution rapide

1. Semaine 1 : cadrage + Docker + Django/React + DB + auth obligatoire + README squelette.
2. Semaine 2 : modeles assets/prices/news/watchlists + API DRF + recherche/pagination.
3. Semaine 3 : dashboard courbes + ingestion donnees + indicateurs techniques.
4. Semaine 4 : LLM/sentiment + rapports de tendance + export/import.
5. Semaine 5 : permissions/profiles/PWA/health/backups + docs modules.
6. Semaine 6 : tests, HTTPS, polish UI, Privacy/Terms, repetition evaluation.

Si l'equipe est 4-5 personnes :

- 1 personne backend/data ingestion ;
- 1 personne frontend/dashboard ;
- 1 personne auth/permissions/API/docs ;
- 1 personne IA/scoring/export ;
- 1 personne DevOps/tests/project management si vous etes 5.

### Adaptation pour une equipe de 4 personnes avec objectif 4 semaines

Avec 4 personnes, finir proprement en 4 semaines est agressif, surtout si l'objectif reste 19 points. Ce n'est pas impossible si l'equipe code beaucoup, mais il faut eviter deux pieges :

- faire trop de modules "interessants" mais non essentiels ;
- repousser Docker, HTTPS, README, Privacy/Terms et tests a la fin.

Strategie conseillee : viser un MVP validable a 14 points au plus tard a la fin de la semaine 3, puis utiliser la semaine 4 pour stabiliser et pousser vers 19 points. Si vous essayez directement de construire les 19 points sans palier a 14, le risque est de finir avec beaucoup de modules a 80%, donc 0 point sur plusieurs d'entre eux.

#### Repartition des roles pour 4 personnes

Chaque personne garde un domaine principal, mais tout le monde doit pouvoir expliquer le produit entier.

| Personne | Ownership principal | Modules portes | Livrables critiques |
|---|---|---|---|
| Dev A - Backend/Data | Django, DB, API, ingestion prix/news | Framework, ORM, Public API, Advanced search | modeles DB, endpoints DRF, API keys/rate-limit, recherche/pagination |
| Dev B - Front/Dashboard | React, UI, charts, PWA | Framework, Analytics dashboard, PWA | dashboard responsive, courbes, filtres, etats loading/erreur, service worker |
| Dev C - Auth/Security/DevOps | auth, permissions, Docker, HTTPS, health/backups | Standard user management, Advanced permissions, Health/status/backups | login/signup, profiles, roles, docker compose, reverse proxy HTTPS, backups |
| Dev D - IA/Scoring/Exports/Docs | scoring technique, LLM, exports, README | LLM interface, Export/import, documentation modules | prompts, streaming/retry/rate-limit, rapports tendance, CSV/JSON, README |

#### Plan 4 semaines agressif

| Semaine | Objectif | Ce qui doit etre fini |
|---|---|---|
| S1 | Socle executable | Docker Compose, Django/React, Postgres, auth email/password, schema DB initial, layout front, README squelette, Privacy/Terms brouillon |
| S2 | Donnees + API + dashboard brut | assets/prices/news, watchlists, ingestion minimale, API REST, API key/rate-limit, recherche/pagination, premieres courbes ECharts |
| S3 | Modules majeurs validables | analytics dashboard avance, LLM interface, scoring tendance, permissions/roles, profiles/avatar, exports, health page, premiers tests |
| S4 | Stabilisation + bonus | PWA, backups/restore doc, HTTPS propre, console Chrome clean, polish UI, tests parcours eval, README final, demonstrations module par module |

#### Palier de validation recommande

Palier fin semaine 2 :

- app lancee avec une commande ;
- inscription/connexion fonctionnelles ;
- au moins une action consultable avec donnees stockees ;
- dashboard affiche une courbe ;
- API REST expose les premieres routes ;
- README contient deja la liste des modules vises.

Palier fin semaine 3 :

- 14 points doivent etre demonstrables sans "imagine que..." ;
- les donnees ne doivent pas dependre d'un service externe fragile au moment de l'evaluation : prevoir seed/cache ;
- les modules restants pour atteindre 19 doivent etre petits et deja bien avances.

Palier fin semaine 4 :

- demo de 15 minutes repetee plusieurs fois ;
- chaque module a une page README qui explique comment le montrer ;
- chaque membre sait expliquer son code, les choix techniques, les limites, et l'usage de l'IA ;
- aucun warning console Chrome ;
- `.env.example`, HTTPS, Privacy Policy, Terms of Service et backups sont verificables.

#### Ajustement des modules pour tenir 4 semaines

Si vous sentez que le temps manque, basculer du Combo A vers une variante plus simple :

- garder : Framework, Public API, ORM, Advanced search, LLM interface, Analytics dashboard, Export/import, Health/status/backups ;
- choisir entre Real-time et Standard user management avance selon l'avancement ;
- repousser PWA ou OAuth en tampon bonus ;
- eviter Organization system, RAG, microservices, ELK/Grafana, WCAG AA complet.

Pour 4 semaines, le meilleur compromis est :

- objectif minimal non negociable : 14 points solides ;
- objectif bonus : 19 points ;
- objectif tampon si l'equipe avance tres vite : 20 ou 21 points, mais seulement avec des modules faciles a demontrer.

## 9. Checklist README a ne pas oublier

Le README doit etre en anglais et contenir :

- premiere ligne italicisee exacte avec les logins 42 ;
- Description : nom du projet, objectif, features ;
- Instructions : prerequis, `.env`, installation, execution, Docker ;
- Resources : docs/articles/tutos + explication de l'usage de l'IA ;
- Team Information : roles PO/PM/Tech Lead/Developers ;
- Project Management : organisation, outils, communication ;
- Technical Stack : frontend, backend, DB, libs, justification ;
- Database Schema : tables/relations/champs ;
- Features List : features + membres responsables ;
- Modules : modules choisis, points, justification, implementation, responsables ;
- Individual Contributions : detail par membre, challenges, solutions ;
- limites connues, licence, credits si pertinent.

## 10. Decision courte

Oui, Python backend + React frontend est un bon choix pour cette idee. Pour aller vite et maximiser les points, je choisirais Django/DRF plutot que FastAPI, sauf si l'equipe connait deja tres bien FastAPI.

Combo recommande : Combo A si vous acceptez WebSocket/SSE ; Combo B si vous voulez reduire le risque technique du real-time.

Modules a eviter pour le chemin critique : jeux, blockchain, WAF/Vault, microservices, WCAG AA complet, RAG complet, recommendation ML. Ils sont interessants, mais trop chers pour atteindre rapidement les 19 points.
