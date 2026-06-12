# Module Advanced Analytics Dashboard

## Statut

- Type : module major
- Valeur : 2 points
- État : implémenté et validé
- Page : `/dashboard`

Le sujet demande :

- des graphiques interactifs ;
- plusieurs types de visualisation ;
- des mises à jour de données en temps réel ;
- un export PDF, CSV ou autre ;
- des plages de dates et des filtres personnalisables.

ClearTrend couvre ce périmètre avec des données financières OHLCV fournies par
le service FastAPI `analysis`.

Les tuiles `Tendance` et `Sentiment` sont maintenant alimentées par le module ML.
Elles enrichissent le dashboard, mais ne sont pas nécessaires pour justifier ce
module : la validation repose sur les graphiques, les filtres, le
rafraîchissement et les exports.

## Architecture générale

Le dashboard traverse les trois couches suivantes :

```text
Navigateur React
  AssetChart / DashboardClient
            |
            | GET /api/assets/candles
            v
Backend Next.js
  authentification, validation, normalisation
            |
            | REST interne Docker
            v
Service FastAPI analysis
  lecture des caches OHLCV et métadonnées
```

Le navigateur ne contacte jamais directement FastAPI. Les routes Next.js
vérifient d'abord la session utilisateur ou la clé API, puis transmettent une
requête limitée aux symboles et périodes acceptés.

Cette séparation permet :

- de ne pas exposer l'adresse du microservice `analysis` au client ;
- de centraliser l'authentification dans le backend web ;
- de normaliser les données avant leur utilisation par React ;
- de conserver FastAPI spécialisé dans les données financières.

## Parcours utilisateur

Depuis le dashboard, l'utilisateur peut :

1. choisir un asset dans la watchlist ;
2. choisir une période ;
3. afficher le prix sous forme de courbe ;
4. afficher les valeurs OHLC sous forme de bougies ;
5. inspecter un point avec la souris ;
6. exporter les données visibles en CSV ou JSON.

Le symbole et la période sont aussi conservés dans l'URL :

```text
/dashboard?symbol=AAPL&range=1M
```

Ce lien permet de retrouver directement la même vue.

## Données utilisées

Le frontend appelle :

```text
GET /api/assets/candles?symbol=AAPL&range=1M
```

La route Next.js :

1. vérifie la session ou la clé API ;
2. valide le symbole et la période ;
3. appelle le service FastAPI ;
4. normalise les bougies ;
5. retourne les données au composant graphique.

Une bougie contient :

```text
datetime
open
high
low
close
volume
```

## Visualisations

Le graphique est dessiné directement en SVG par React. Aucune bibliothèque de
visualisation externe n'est utilisée.

Ce choix donne un contrôle précis sur les axes, la largeur des bougies, les
tooltips et le rendu mobile. Il évite aussi d'ajouter une dépendance lourde pour
deux représentations financières bien définies. En contrepartie, les calculs de
coordonnées, de domaines et de placement des tooltips sont maintenus dans le
projet.

### Courbe de prix

La vue `Price` affiche :

- la clôture de chaque bougie ;
- une ligne et une zone colorée ;
- les axes temporel et financier ;
- la performance de la période ;
- un tooltip avec la date et le prix.

### Bougies OHLC

La vue `Candles` utilise les mêmes données et affiche :

- une mèche entre le minimum `low` et le maximum `high` ;
- un corps entre l'ouverture `open` et la clôture `close` ;
- une bougie verte lorsque la clôture est supérieure ou égale à l'ouverture ;
- une bougie rouge lorsque la clôture est inférieure à l'ouverture ;
- un tooltip compact avec la date et les libellés complets `Ouverture`,
  `Plus haut`, `Plus bas` et `Cloture`.

La granularité vient directement de la période choisie :

```text
1D -> 5 minutes
1W -> 1 heure
1M / 3M / 1Y -> 1 jour
```

## Plages et filtres

Périodes disponibles :

```text
1D
1W
1M
3M
1Y
```

Filtres disponibles :

- asset sélectionné dans la watchlist ;
- période du graphique ;
- début et fin personnalisés dans la période chargée ;
- type de visualisation `Price` ou `Candles` ;
- période de performance de la watchlist.

Les changements d'asset et de période rechargent les bougies correspondantes.
Le filtre début/fin travaille ensuite localement sur ces bougies. Pour `1D` et
`1W`, il accepte aussi l'heure. Le graphique, le nombre de points et les exports
utilisent uniquement les bougies restantes.

Le filtrage local a été choisi parce que la période produit est déjà bornée et
chargée dans le navigateur. Modifier une date ne provoque donc pas une nouvelle
requête serveur et le résultat est immédiat. Ce filtre ne permet toutefois pas
de demander une période arbitraire située en dehors de la plage chargée.

Les snapshots `1D` et les performances de watchlist sont chargés par lots de
20 symboles, avec deux lots simultanés. Les requêtes identiques en cours sont
partagées entre utilisateurs et les résultats sont gardés 30 secondes côté
`web`. Le sélecteur affiche `...` pendant le chargement; `N/A` indique ensuite
une absence réelle de données pour l'asset et la période.

## Rafraîchissement automatique

Le dashboard utilise la fréquence configurée par l'administrateur, avec une
valeur minimale d'une minute.

Fonctionnement :

1. le graphique charge les bougies à son ouverture ;
2. il programme le prochain contrôle du cache `analysis` ;
3. il recharge les données quand une nouvelle version est disponible ;
4. en cas d'échec en arrière-plan, il conserve le graphique déjà visible ;
5. lorsque l'onglet redevient visible, il contrôle immédiatement les données.

Le footer affiche la source, l'intervalle, le nombre de points, la date de la
dernière bougie de marché et la date relative de mise à jour du cache. Cette
séparation évite de confondre une dernière séance du vendredi avec un cache
rafraîchi ou un export effectué pendant le week-end.

Il affiche aussi la prochaine ouverture régulière du marché américain. Le
calcul utilise 9h30 à New York, ignore les week-ends et les principaux jours
fériés NYSE, puis affiche le résultat dans le fuseau local du navigateur.

Ce rafraîchissement automatique valide la mise à jour des données du dashboard.
Il ne doit pas être confondu avec le module distinct WebSocket/SSE, qui reste à
implémenter.

Le contrôle léger utilise d'abord l'endpoint de métadonnées
`/api/assets/candles/meta`. Les bougies complètes ne sont rechargées que lorsque
`updatedAt` a changé. Cela évite de transférer plusieurs fois le même historique.

## Export CSV

Le bouton `Export CSV` génère un fichier :

```text
cleartrend-aapl-1m-YYYY-MM-DD.csv
```

La date du nom de fichier est la date d'export. La date de chaque point de
marché reste présente dans la colonne `datetime`.

Colonnes :

```text
symbol
range
datetime
open
high
low
close
volume
change_percent
```

`change_percent` correspond a la variation entre l'ouverture et la clôture de
la bougie.

## Export JSON

Le bouton `Export JSON` génère un document versionné :

```json
{
  "format": "cleartrend-chart",
  "version": 1,
  "symbol": "AAPL",
  "range": "1M",
  "interval": "1day",
  "source": "Analysis",
  "updatedAt": "2026-06-07T12:00:00Z",
  "exportedAt": "2026-06-07T12:01:00Z",
  "candles": []
}
```

Chaque entrée de `candles` contient les valeurs OHLCV et la variation de la
bougie.

Les fichiers sont générés localement dans le navigateur à partir des données
déjà authentifiées. Aucun fichier temporaire n'est stocké sur le serveur.

Cette approche évite un stockage serveur inutile et garantit que l'export
correspond exactement au filtre actuellement visible.

## États gérés

Le graphique gère :

- chargement ;
- erreur de récupération ;
- absence de données ;
- boutons d'export désactivés sans données ;
- préservation du graphique lors d'un échec de rafraîchissement en arrière-plan.

## Responsive et accessibilité

Sur mobile :

- les périodes `1D` à `1Y` restent toujours visibles sous le titre ;
- un bouton chevron replie par défaut les dates, le type de graphique et les
  exports ;
- les contrôles sont répartis sur plusieurs lignes ;
- les boutons d'export utilisent toute la largeur disponible ;
- le graphique utilise un format compact ;
- le tooltip souris est masqué pour éviter une interaction tactile incohérente.

Les contrôles utilisent des boutons natifs, `aria-pressed` pour les périodes et
des labels accessibles pour les visualisations et les exports.

## Fichiers principaux

| Fichier | Rôle |
|---|---|
| `web/src/components/AssetChart.tsx` | État du graphique, SVG, interactions, filtres, polling et téléchargement |
| `web/src/components/DashboardClient.tsx` | Sélection de l'asset, période active et intégration dans le dashboard |
| `web/src/lib/analysis-data.ts` | Contrat des bougies, validation, normalisation et appels au service `analysis` |
| `web/src/lib/chart-analytics.ts` | Génération CSV/JSON et noms de fichiers |
| `web/src/lib/chart-layout.ts` | Calcul robuste de la largeur des bougies |
| `web/src/lib/market-calendar.ts` | Calcul de la prochaine ouverture régulière américaine |
| `web/src/app/api/assets/candles/route.ts` | Endpoint authentifié retournant les bougies |
| `web/src/app/api/assets/candles/meta/route.ts` | Endpoint léger de contrôle de fraîcheur |
| `analysis/src/market_data_views.py` | Choix des caches et conversion en bougies OHLCV |
| `analysis/src/market_data_history.py` | Lecture et composition des historiques |
| `analysis/src/scheduler.py` | Mise à jour périodique des caches |
| `tests/scripts/test-chart-export.mjs` | Tests des exports, du calendrier et du layout |

La largeur des bougies utilise l'espacement médian entre les points. En `1D`,
elle est plafonnée pour éviter des bougies trop larges en début de séance ou
lorsque le fournisseur retourne momentanément peu de points.

## Tests automatisés

Commande :

```bash
make test-analytics-dashboard
```

Le test vérifie :

- les colonnes CSV ;
- les lignes OHLCV ;
- la variation en pourcentage ;
- les valeurs absentes ;
- le format et la version JSON ;
- les métadonnées du graphique ;
- le nom du fichier exporté ;
- la prochaine ouverture avant et après 9h30 à New York ;
- le passage des week-ends, d'un jour férié NYSE et du changement
  heure d'hiver/heure d'été.

Le script couvre les calculs purs les plus sensibles. Le rendu visuel et les
interactions souris/tactiles restent vérifiés manuellement.

Vérification globale :

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T web npm run lint
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T web npm run build
```

## Test manuel conseillé

1. ouvrir `/dashboard` avec un compte connecté ;
2. sélectionner `AAPL` ;
3. parcourir les périodes `1D`, `1W`, `1M`, `3M`, `1Y` ;
4. limiter la vue avec les champs de début et de fin ;
5. sur desktop, survoler plusieurs points de la courbe ;
6. passer de `Price` à `Candles` ;
7. vérifier les mèches high/low, les corps open/close et le tooltip OHLC ;
8. exporter le CSV et contrôler les colonnes et la période filtrée ;
9. exporter le JSON et contrôler `format`, `version`, `symbol` et `range` ;
10. changer d'asset et vérifier que le nom et le contenu des exports changent ;
11. réduire la fenêtre pour vérifier les contrôles mobiles.

## Limites assumées

- Le dashboard utilise du polling et non WebSocket/SSE.
- Les exports disponibles sont CSV et JSON, pas PDF.
- Le filtre début/fin reste borné par la période produit chargée.
- Les visualisations sont une courbe et des bougies OHLC ; il n'existe pas de
  graphique en barres ou en secteurs.
- La prochaine ouverture utilise le calendrier régulier américain. Cette
  indication n'est pas adaptée au Bitcoin et à Ethereum, qui cotent 24 h/24, ni
  à tous les calendriers internationaux ou contrats futures.
- Les tests automatisés ne réalisent pas de comparaison de captures d'écran
  multi-navigateurs.

Ces limites ne retirent aucun des parcours principaux du module : plusieurs
visualisations interactives, filtres, périodes, mises à jour et export sont
disponibles.
