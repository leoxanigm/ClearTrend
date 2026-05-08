# Notes de reference Codex - ft_transcendence stock dashboard

But utilisateur : choisir les meilleurs modules major/minor pour atteindre vite 19 pts, avec projet web d'analyse de tendance d'action : collecte infos, courbes, sentiment IA, tendance hausse/baisse.

Sujet lu : `en.subject.pdf`, ft_transcendence Surprise v21.1.

Regles sujet :

- Web app libre mais obligatoire : frontend + backend + DB.
- Docker/Podman/equivalent, lancement en une commande.
- Chrome stable, pas d'erreurs/warnings console.
- Privacy Policy + Terms of Service accessibles et pertinents.
- Multi-user obligatoire.
- Auth basic email/password securisee.
- CSS framework/styling solution.
- `.env` local ignore + `.env.example`.
- Schema DB clair.
- Validation frontend + backend.
- HTTPS navigateur -> backend.
- README anglais tres complet.
- Modules : 14 pts requis ; major 2 ; minor 1.
- Bonus : seulement apres 14 pts valides, max +5. Donc 19 valides = bonus max.

Hypothese stack recommandee :

- Front : TypeScript/JavaScript, Node.js 24 LTS, React 19.2.x, Vite 8.x, Tailwind 4.x.
- Back : Python 3.13.x recommande, Django 5.2.x LTS, DRF 3.17.x.
- DB : SQL/PostgreSQL 18.x ou 17.x.
- Jobs : Python/Celery 5.6.x + Redis broker/cache.
- Charts : TypeScript/JavaScript, ECharts 6.x recommande pour finance.
- DevOps : YAML/Shell, Docker Compose v2, reverse proxy HTTPS.
- Tests : Python pytest/pytest-django, TypeScript Vitest, Playwright optionnel.
- Raison versions : privilegier LTS/stable. Python 3.13 plutot que 3.14 pour compat ecosysteme ; Django 5.2 LTS plutot que 6.0 pour support long ; Node 24 LTS plutot que Node 25 Current ; TS 6 stable plutot que TS 7 beta/dev.

Architecture produit :

- Users/profiles/roles/permissions.
- Assets/price_candles/news_items/watchlists.
- Technical indicators + sentiment_runs + trend_reports.
- API secured + rate limit + API keys.
- Dashboard charts + LLM explanations + exports.

Contexte equipe/planning :

- Projet prevu a 4 personnes.
- Ideal : 4 semaines, mais c'est agressif pour 19 pts.
- Strategie : 14 pts demonstrables fin semaine 3, puis semaine 4 stabilisation + push vers 19.
- Repartition : A backend/data/API ; B front/dashboard/charts/PWA ; C auth/permissions/DevOps/health ; D IA/scoring/exports/docs.
- Ne pas repousser Docker/HTTPS/README/Privacy/Terms/tests en fin de projet.

Combos :

- A recommande 19 exact :
  - Majors : FE+BE framework, public API, real-time, standard user management, advanced permissions, LLM interface, analytics dashboard = 14.
  - Minors : ORM, advanced search, PWA, data export/import, health/status/backups = 5.
- B sans real-time :
  - Majors : FE+BE framework, public API, standard user management, advanced permissions, LLM interface, analytics dashboard = 12.
  - Minors : ORM, advanced search, notifications CRUD, OAuth, export/import, GDPR, health/status/backups = 7.
- C finance collaboratif :
  - Majors : FE+BE framework, public API, real-time, advanced permissions, organization system, LLM interface, analytics dashboard = 14.
  - Minors : ORM, advanced search, export/import, GDPR, health/status/backups = 5.

Notes de prudence :

- Major framework complet + minors frontend/backend : le sujet v21.1 ne l'interdit pas explicitement, mais ne pas compter les trois par prudence. C'est probablement refuse comme double comptage d'une meme implementation ; demander confirmation campus/evaluateur si l'equipe veut tenter.
- Le minor sentiment dit "user-generated content"; pour news/actions, claim LLM interface ou custom module plutot que ce minor.
- Custom module interessant mais a ne pas mettre dans le chemin critique : validation plus subjective.
- Eviter jeux/blockchain/WAF+Vault/microservices/RAG/recommendation ML pour la vitesse.
- Scraping : preferer API/RSS/sources autorisees, rate-limit, cache, trace sources, disclaimer not financial advice.
