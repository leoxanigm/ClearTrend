# Notes a corriger

Petite liste des points techniques a reprendre plus tard. Garder ce document
court: une note = un probleme, son impact, et une piste simple.

## Watchlist chargee en entier a la connexion

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

## Recherche avancee a raccorder et valider

Probleme:

- La page `/search` appelle bien `/api/search`, et `/api/search` utilise Prisma.
- Mais les tables cherchees (`assets`, `analyses`, `reports`, `notifications`)
  ne semblent pas toutes alimentees par les flows actuels.
- Les filtres existent cote UI, mais il faut verifier les resultats reels avec
  des donnees de demo completes.

Impact:

- Le module "Advanced search" ne doit pas etre considere comme valide tant que
  la recherche ne retourne pas des donnees utiles sur plusieurs types.
- Risque de demo: l'UI peut fonctionner mais afficher surtout du vide.

Pistes:

- Ajouter ou generer des donnees de demo pour `assets`, `analyses`, `reports`
  et `notifications`.
- Verifier `q`, `type`, `sort`, `direction`, `page`, `limit`, `dateFrom`,
  `dateTo`, `sentiment` et `source` sur `/api/search`.
- Verifier que les ajouts watchlist et les donnees marche creent/mettent a jour
  les assets recherchables en base.
- Ajouter au moins un test manuel documente avec une requete qui retourne chaque
  type de resultat.

## Analytics dashboard avance a terminer

Probleme:

- Le dashboard affiche deja un chart interactif et des performances par periode.
- Il manque encore des elements demandes pour valider le module complet:
  export, filtres avances, sentiment timeline et trend score reels.

Impact:

- Le module peut etre presente comme en cours, mais pas comme valide.
- Risque de refus si l'evaluation attend explicitement export CSV/JSON et
  analytics sentiment/trend connectes au backend.

Pistes:

- Ajouter un export CSV/JSON pour les candles du chart ou le dashboard courant.
- Brancher les cartes trend/sentiment sur des donnees `analysis` reelles.
- Ajouter une vue ou timeline sentiment/trend si les donnees existent.
- Documenter un parcours de demo avec range, watchlist performance, refresh,
  loading/error/empty et export.

## Real-time WebSocket/SSE a implementer

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
