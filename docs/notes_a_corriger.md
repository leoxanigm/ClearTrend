# Notes a corriger

Petite liste des points techniques a reprendre plus tard. Garder ce document
court: une note = un probleme, son impact, et une piste simple.

Les estimations sont volontairement approximatives: elles donnent un ordre de
grandeur en difficulte et en lignes code/docs/tests, pas un chiffrage exact.

## Synthese rapide

| Module / sujet | A modifier / ajouter / supprimer |
|---|---|
| Watchlist chargee en entier | Ajouter chargement progressif, priorite au symbole selectionne, cache ou pagination. |
| ML Trend Prediction | Ajouter la cle Gemini, tester le sentiment reel et valider le scenario de demo. |
| Recherche avancee | Ajouter donnees demo, alimenter les tables recherchees et valider filtres/tri/pagination. |
| Public API securisee | Ajouter namespace public versionne, rate limit API key, OpenAPI et endpoints manquants. |
| OAuth 2.0 | Nettoyer `.env.example`, documenter callbacks et gerer l'affichage des providers non configures. |
| Notifications CRUD | Ajouter endpoints CRUD, notifications persistantes et centre de notifications UI. |
| I18n polish | Remplacer les derniers textes hardcodes des toasts et labels secondaires. |
| Advanced permissions | Ajouter changement de role, helper `requireRole`, vrai role `ANALYST` et CRUD admin plus complet. |
| Real-time WebSocket/SSE | Ajouter endpoint SSE/WebSocket, hook client, events serveur et demo multi-onglets. |
| Migrations Prisma | Ajouter migrations versionnees et eviter `db push --accept-data-loss` comme flow normal. |
| Schema DB | Ajouter un schema visuel simple pour expliquer les relations principales. |

## Watchlist chargee en entier a la connexion

Estimation: difficulte 2/5, environ 80-180 lignes selon le niveau de cache ou de
chargement progressif choisi.

Probleme:

- A l'ouverture du dashboard, l'utilisateur voit rapidement la liste, puis le
  client recharge les donnees marche pour toute la watchlist.
- Avec plusieurs navigateurs ou plusieurs instances ouvertes, cela peut ralentir
  l'affichage des prix et variations.

Impact:

- Ce n'est pas un probleme de compatibilite navigateur.
- Cela peut fragiliser la demo si plusieurs personnes testent le dashboard en
  meme temps.

Pistes:

- Charger seulement les premiers symboles visibles au depart.
- Charger le symbole selectionne en priorite.
- Ajouter un chargement progressif ou pagine pour le reste de la watchlist.
- Mettre en cache les snapshots cote `web` ou `analysis` pour eviter de relire
  tous les fichiers a chaque instance.
- Limiter la watchlist demo par defaut si besoin pendant l'evaluation.

## ML Trend Prediction a finaliser

Estimation restante: difficulte 2/5, environ 20-80 lignes de correction selon
les retours Gemini, puis documentation et verification manuelle.

Etat:

- Le module est maintenant traite comme un module Major personnalise, et non
  comme le module officiel de recommandations personnalisees.
- La regression historique, le backtest temporel, Reddit RSS, ApeWisdom, la
  fusion, les endpoints et les tuiles dashboard sont implementes.
- Chaque asset est entraine independamment une fois par jour dans un job backend
  apres le refresh daily. Les clients lisent tous le meme snapshot persiste.
- Les tests locaux et le parcours authentifie web vers FastAPI passent.
- La partie Gemini n'a pas encore ete executee avec une vraie cle.

Reste a faire avant validation:

- Ajouter `GEMINI_API_KEY` dans `.env`, sans la commit.
- Recreer `analysis` pour charger la variable d'environnement.
- Tester NVDA, Bitcoin et un asset avec peu de messages.
- Verifier que les messages Reddit retenus parlent bien de l'investissement.
- Ajuster seulement les filtres ou le prompt si Gemini classe du contenu hors
  sujet; ne pas modifier les poids pour fabriquer une tendance attendue.
- Conserver une capture ou une sortie JSON des trois horizons pour la demo.
- Expliquer que le prix estime est experimental et que la confiance n'est pas
  une probabilite de gain.

Option ulterieure, non necessaire a la premiere validation:

- Historiser les signaux et leurs resultats reels pendant plusieurs semaines.
- Entrainer ensuite un meta-modele sur ces observations. Une Random Forest
  multi-source n'est pas justifiee avant de disposer de cet historique social.

## Recherche avancee a raccorder et valider

Estimation: difficulte 3/5, environ 120-300 lignes surtout pour alimenter les
donnees, stabiliser le parcours demo et documenter les tests manuels.

Probleme:

- La recherche rapide de la watchlist fonctionne via `/api/assets/search` et le
  service `analysis`.
- Le bouton "Advanced Search" renvoie vers `/search`.
- La page `/search` existe et appelle techniquement `/api/search`.
- `/api/search` utilise Prisma avec filtres, tri et pagination sur `assets`,
  `analyses`, `reports` et `notifications`.
- Le probleme n'est donc pas une absence totale de connexion UI -> API.
- Le probleme reel est que les donnees ciblees ne sont pas toutes alimentees par
  les flows actuels, donc l'interface avancee risque surtout d'afficher du vide.

Impact:

- Le module "Advanced search" ne doit pas etre considere comme valide tant que
  la page `/search` ne retourne pas des donnees utiles et verifiables.
- Risque de demo: l'UI et l'endpoint peuvent exister, mais ne pas prouver une
  recherche avancee exploitable.

Pistes:

- Ajouter ou generer des donnees de demo pour `assets`, `analyses`, `reports`
  et `notifications`.
- S'assurer que les flows actuels creent/mettent a jour les `assets` en base
  quand la watchlist ou le chart utilise un symbole.
- Verifier `q`, `type`, `sort`, `direction`, `page`, `limit`, `dateFrom`,
  `dateTo`, `sentiment` et `source` sur `/api/search`.
- Verifier le bouton "Advanced Search" depuis la watchlist jusqu'aux resultats
  reels.
- Verifier que chaque type (`assets`, `analyses`, `reports`, `notifications`)
  retourne au moins un resultat dans un scenario demo.
- Ajouter au moins un test manuel documente avec une requete qui retourne chaque
  type de resultat.

## Public API securisee a finaliser

Estimation: difficulte 4/5, environ 300-700 lignes pour namespace public,
rate limit par API key, endpoints manquants, OpenAPI JSON, erreurs standard et
tests curl.

Probleme:

- Le projet a deja une bonne base: table `api_keys`, hash de la cle, prefix,
  `lastUsedAt`, champ `revokedAt`, page de gestion de cle et exemples curl.
- Les routes existantes acceptent `Authorization: Bearer <api_key>` ou
  `X-API-Key: <api_key>`.
- La watchlist expose deja `GET`, `POST`, `PUT`, `PATCH` et `DELETE`.
- Les routes candles, search, performance et advanced search acceptent aussi une
  identite API.
- Mais ce sont encore les routes produit internes (`/api/assets/...`,
  `/api/search`) plutot qu'une API publique versionnee claire.
- Le rate limit existe en memoire pour login/register, mais il n'est pas applique
  aux endpoints publics par API key.
- Il n'y a pas encore de contrat OpenAPI JSON.
- Les endpoints publics ne couvrent pas encore proprement reports et
  notifications.
- Le champ `revokedAt` existe mais la suppression de cle supprime la ligne au
  lieu de conserver une trace de revocation.

Impact:

- Le module ne doit pas etre considere comme valide pour 2 points en l'etat.
- La partie securite API key est defendable comme fondation.
- Le risque principal en evaluation: l'examinateur demande rate limit,
  versioning, documentation machine-readable ou endpoints reports/notifications,
  et on ne peut montrer qu'une API interne partiellement documentee.

Pistes:

- Decider le contrat public: garder les routes actuelles ou creer
  `/api/public/v1`.
- Ajouter un helper strict `requirePublicApiKey` si l'API publique doit refuser
  les sessions navigateur.
- Ajouter un rate limit applique aux API keys, idealement stocke en Postgres
  pour rester coherent avec Docker/multi-instance.
- Ajouter des headers de rate limit: limite, restant, reset, et retourner `429`
  quand la limite est atteinte.
- Ajouter ou exposer proprement au moins 5 endpoints publics, par exemple:
  `GET /assets`, `GET /assets/:symbol/candles`,
  `GET/POST/PUT/DELETE /watchlists`, `GET /reports`,
  `GET/POST/PATCH/DELETE /notifications`.
- Ajouter `/api/public/v1/openapi.json` avec schemas, securite API key,
  parametres, reponses et exemples.
- Standardiser les erreurs publiques avec un format stable, par exemple
  `{ "error": { "code": "...", "message": "..." } }`.
- Utiliser `revokedAt` pour revoquer les cles au lieu de toujours supprimer la
  ligne, sauf si on veut explicitement une suppression definitive.
- Ajouter une checklist curl: sans cle -> `401`, cle invalide -> `401`, cle
  valide -> `200/201`, rate limit -> `429`, suppression/revocation -> `401`.
- Documenter la creation de cle, son affichage unique, son stockage hashe, et la
  facon de l'utiliser dans le README.

## OAuth 2.0 a nettoyer

Estimation: difficulte 1/5, environ 20-80 lignes surtout pour config et docs.

Probleme:

- `.env.example` contient `AUTH_SECRET` deux fois, dont une ligne qui ressemble
  a une commande au lieu d'une valeur.
- Les providers sont toujours affiches meme si les credentials sont absents ou
  placeholders dans un environnement donne.
- Le lien avec un compte email/password existant portant le meme email n'est pas
  vraiment formalise.

Impact:
- Les corrections restantes servent surtout a rendre le setup plus propre et a
  eviter des erreurs sur une nouvelle installation.

Pistes:

- Corriger `.env.example`: un seul `AUTH_SECRET`, et une indication claire du
  type de valeur attendu.
- Documenter les callback URLs a configurer cote providers, par exemple
  `/api/auth/callback/google`, `/api/auth/callback/github` et
  `/api/auth/callback/42-school`.
- Masquer ou desactiver les boutons des providers non configures pour eviter des
  erreurs pendant la demo. => si providers pas fonctionel car pas de cle dans le env par exemple
- Decider si un compte OAuth doit etre relie a un compte credentials existant si
  l'email est identique, ou si les comptes restent separes.

## Notifications CRUD a implementer

Estimation: difficulte 3/5, environ 180-400 lignes pour API CRUD, creation
automatique, centre de notifications UI et tests manuels.

Probleme:

- Il n'existe pas encore de route `/api/notifications`.
- Les notifications persistantes ne sont pas creees automatiquement lors des
  mutations principales.
- Il n'existe pas encore de centre de notifications dans le dashboard.
- Les toasts actuels sont locaux au navigateur et ne suffisent pas pour valider
  un CRUD de notifications.
- Exemple deja present: la modification du profil affiche un toast
  `Profile updated` ou `Profile update failed`, mais ce toast n'est pas enregistre
  dans la table `notifications`.

Impact:

- Le module ne doit pas etre considere comme valide en l'etat.
- Risque de confusion a l'oral: un toast UI n'est pas une notification CRUD
  persistante.
- Les toasts profil peuvent etre cites comme fondation UI, mais pas comme preuve
  du module complet.

Pistes:

- Ajouter `web/src/app/api/notifications/route.ts` pour `GET` liste et `POST`
  creation si besoin admin/system.
- Ajouter `web/src/app/api/notifications/[id]/route.ts` pour `PATCH` mark
  read/unread ou update status, et `DELETE`.
- Restreindre toutes les requetes au `userId` courant.
- Creer des notifications dans les mutations importantes: watchlist add/remove,
  API key create/revoke, report/export ready, analysis failed/succeeded.
- Ajouter une petite UI dashboard: compteur non lu, liste, action mark read,
  action delete.
- Ajouter un scenario demo: creer une action, voir la notification en DB/UI,
  la marquer lue, puis la supprimer.
- Prevoir plus tard le branchement SSE via `notification.created`, mais ne pas
  bloquer le CRUD dessus.

## I18n polish textes hardcodes

Estimation: difficulte 1/5, environ 20-80 lignes pour extraire les derniers
titres de toasts et libelles secondaires.

Probleme:

- Quelques textes user-facing restent en dur dans des toasts ou libelles
  secondaires: `Logged in`, `Account created`, `Profile updated`,
  `Account deleted`, `Dismiss notification`.
- La page `/ui-showcase` contient aussi du texte anglais, mais c'est une page
  interne de demo non liee dans la navigation produit.

Impact:

- Pour une finition stricte, les toasts devraient utiliser les cles deja
  presentes dans les fichiers de traduction ou de nouvelles cles dediees.

Pistes:

- Remplacer les titres de toasts hardcodes par `useTranslations`.
- Ajouter quelques cles si besoin, par exemple `notifications.loggedIn`,
  `notifications.profileUpdated`, `notifications.accountDeleted`.
- Traduire le label par defaut `Dismiss notification` du composant `Toast` ou le
  passer depuis `NotificationProvider`.
- Laisser `/ui-showcase` en anglais si on assume que c'est une page interne de
  demonstration technique.

## Advanced permissions a finaliser

Estimation: difficulte 3/5, environ 180-450 lignes pour role update, CRUD admin,
policy helper, UI et tests manuels.

Probleme:

- La page admin permet surtout de lister, chercher, trier et ban/unban les
  utilisateurs.
- Il n'y a pas encore de CRUD utilisateur complet cote admin.
- Il n'y a pas encore d'action admin pour changer le role d'un utilisateur.
- Le role `ANALYST` existe dans le schema mais n'a pas encore de permissions ou
  vues specifiques.
- Le helper actuel est admin-only; il manque un helper generique du type
  `requireRole`.

Impact:

- Le module "Advanced permissions" ne doit pas etre considere comme valide en
  l'etat.
- Il est bien avance, mais le risque de refus reste fort si l'evaluation demande
  explicitement roles multiples, actions par role et CRUD users.

Pistes:

- Ajouter une action admin pour modifier `role` avec protection contre la perte
  du dernier admin.
- Ajouter un helper serveur `requireRole(["ADMIN", "ANALYST"])` ou equivalent.
- Donner un vrai droit a `ANALYST`, par exemple acces a une vue d'analyse ou a
  une action que `USER` ne peut pas faire.
- Completer le CRUD utilisateur admin: au minimum update role/status/profil, et
  decider si create/delete sont vraiment necessaires ou si ban/delete suffit
  pour la demo.
- Ajouter un scenario demo: user standard refuse sur `/admin`, analyst accede a
  sa vue dediee mais pas au panneau admin, admin modifie role et ban/unban.

## Real-time WebSocket/SSE a implementer

Estimation: difficulte 4/5, environ 250-500 lignes pour endpoint SSE, registre
d'abonnes, hook client, events metier et parcours demo multi-onglets.

Probleme:

- Il n'existe pas encore d'endpoint `/api/events`.
- Le code ne contient pas encore `EventSource`, `text/event-stream`,
  `WebSocket` ou hook temps reel.
- Le dashboard utilise du polling pour le chart, ce qui ne valide pas le module
  "Real-time WebSocket/SSE" a lui seul.
- Les toasts actuels sont locaux au navigateur via `NotificationProvider`; ils
  ne sont pas diffuses entre clients.

Impact:

- Le module ne doit pas etre considere comme valide.
- Risque de confusion a l'oral: le refresh chart est utile, mais ce n'est pas
  un canal real-time serveur -> clients.

Pistes implementation SSE:

- Creer `web/src/app/api/events/route.ts`.
- Authentifier la requete avec la session utilisateur.
- Retourner un `ReadableStream` avec headers:
  `Content-Type: text/event-stream`, `Cache-Control: no-cache`,
  `Connection: keep-alive`.
- Envoyer un heartbeat toutes les 15-30 secondes pour garder la connexion
  ouverte.
- Nettoyer l'abonnement quand le client ferme la connexion.
- Definir un format d'event stable, par exemple:
  `notification.created`, `analysis.updated`, `watchlist.updated`.
- Ajouter un helper serveur pour publier un event depuis les routes API qui
  modifient les donnees.
- Pour une premiere version single-container, un registre d'abonnes en memoire
  peut suffire. Pour une version plus robuste, utiliser Postgres `LISTEN/NOTIFY`
  ou une table d'events.

Pistes cote client:

- Ajouter un hook `useEventSource` ou un provider real-time global.
- Ouvrir `new EventSource('/api/events')` apres authentification.
- Sur `notification.created`, afficher un toast et/ou recharger les
  notifications.
- Sur `watchlist.updated`, recharger la watchlist ou appliquer le changement.
- Sur `analysis.updated`, rafraichir le chart, le score trend ou le sentiment.
- Gerer `onerror` avec l'etat "deconnecte" et laisser `EventSource` reconnecter
  automatiquement.
- Ajouter un bouton fallback "refresh" si le flux est indisponible.

Parcours demo attendu:

- Ouvrir deux onglets ou deux navigateurs connectes au meme compte.
- Modifier la watchlist dans le premier onglet.
- Voir le second onglet recevoir `watchlist.updated` sans refresh manuel.
- Creer une notification serveur et voir `notification.created` apparaitre dans
  les deux clients connectes.

## Migrations Prisma a versionner

Estimation: difficulte 2/5, environ 20-80 lignes manuelles. Les fichiers de
migration generes peuvent etre plus longs, mais le travail humain reste limite.

Probleme:

- Prisma est bien utilise comme ORM et le schema est valide.
- Le repo ne contient pas encore de migrations Prisma versionnees.
- En dev, le projet s'appuie surtout sur `prisma db push --accept-data-loss`.
- Quand on change le schema DB, le reflexe actuel est souvent `make fclean`
  puis `make dev`, ce qui reconstruit une base propre mais efface les donnees.

Impact:

- Le module ORM reste validable.
- Mais l'evolution de schema est moins propre a expliquer et moins reproductible
  qu'avec des migrations committees.
- Apres un `git pull`, les autres devs ne recuperent pas un historique clair des
  changements DB; ils doivent souvent reset ou repush le schema.

Pistes:

- Creer une premiere migration avec `npm run db:migrate`.
- Commiter le dossier `web/prisma/migrations`.
- Garder `db push` uniquement pour le developpement rapide, pas pour le mode
  evaluation.
- Adapter ensuite le flow dev pour appliquer les migrations apres un pull, par
  exemple avec `npm run db:migrate:deploy` dans le lancement Docker si besoin.
- Garder `make fclean` comme solution de reset volontaire, pas comme mecanisme
  normal pour chaque changement de schema.

## Schema DB a documenter

Estimation: difficulte 1/5, environ 40-120 lignes de documentation selon le
niveau de detail du schema et des relations.

Probleme:

- Le schema Prisma contient beaucoup de tables et relations utiles.
- Pour l'evaluation, lire directement `schema.prisma` peut etre trop dense.

Impact:

- Le module ORM est valide, mais il sera plus simple a defendre avec un schema
  visuel de la base.
- Cela aide aussi a expliquer les liens entre users, assets, watchlists,
  analyses, reports, notifications et API keys.

Pistes:

- Ajouter un petit diagramme DB dans `docs/`, par exemple
  `docs/database_schema.md`.
- Montrer les relations principales:
  `User -> Watchlist -> WatchlistItem -> Asset`,
  `User -> Analysis -> AnalysisSource`,
  `Analysis -> Report`, `User -> Notification`, `User -> ApiKey`.
- Garder le diagramme simple: objectif oral/evaluation, pas documentation
  exhaustive de chaque colonne.
