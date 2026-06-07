# Module Advanced Analytics Dashboard

## Statut

- Type : module major
- Valeur : 2 points
- Etat : implemente et valide
- Page : `/dashboard`

Le sujet demande :

- des graphiques interactifs ;
- plusieurs types de visualisation ;
- des mises a jour de donnees en temps reel ;
- un export PDF, CSV ou autre ;
- des plages de dates et des filtres personnalisables.

ClearTrend couvre ce perimetre avec des donnees financieres OHLCV fournies par
le service FastAPI `analysis`.

Les tuiles `Trend` et `Sentiment` ne font pas partie de cette validation. Elles
restent reservees au futur module ML.

## Parcours utilisateur

Depuis le dashboard, l'utilisateur peut :

1. choisir un asset dans la watchlist ;
2. choisir une periode ;
3. afficher le prix sous forme de courbe ;
4. afficher le volume sous forme de barres ;
5. inspecter un point avec la souris ;
6. exporter les donnees visibles en CSV ou JSON.

Le symbole et la periode sont aussi conserves dans l'URL :

```text
/dashboard?symbol=AAPL&range=1M
```

Ce lien permet de retrouver directement la meme vue.

## Donnees utilisees

Le frontend appelle :

```text
GET /api/assets/candles?symbol=AAPL&range=1M
```

La route Next.js :

1. verifie la session ou la cle API ;
2. valide le symbole et la periode ;
3. appelle le service FastAPI ;
4. normalise les bougies ;
5. retourne les donnees au composant graphique.

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

### Courbe de prix

La vue `Price` affiche :

- la cloture de chaque bougie ;
- une ligne et une zone coloree ;
- les axes temporel et financier ;
- la performance de la periode ;
- un tooltip avec la date et le prix.

### Barres de volume

La vue `Volume` utilise les memes bougies et affiche :

- une barre par point ;
- une hauteur proportionnelle au volume ;
- un axe adapte aux grands nombres ;
- un tooltip avec la date et le volume.

Si la source ne fournit aucun volume, l'interface affiche un etat explicite au
lieu d'un graphique vide.

## Plages et filtres

Periodes disponibles :

```text
1D
1W
1M
3M
1Y
```

Filtres disponibles :

- asset selectionne dans la watchlist ;
- periode du graphique ;
- debut et fin personnalises dans la periode chargee ;
- type de visualisation `Price` ou `Volume` ;
- periode de performance de la watchlist.

Les changements d'asset et de periode rechargent les bougies correspondantes.
Le filtre debut/fin travaille ensuite localement sur ces bougies. Pour `1D` et
`1W`, il accepte aussi l'heure. Le graphique, le nombre de points et les exports
utilisent uniquement les bougies restantes.

## Rafraichissement automatique

Le dashboard utilise la frequence configuree par l'administrateur, avec une
valeur minimale d'une minute.

Fonctionnement :

1. le graphique charge les bougies a son ouverture ;
2. il programme le prochain controle du cache `analysis` ;
3. il recharge les donnees quand une nouvelle version est disponible ;
4. en cas d'echec en arriere-plan, il conserve le graphique deja visible ;
5. lorsque l'onglet redevient visible, il controle immediatement les donnees.

Le footer affiche la source, l'intervalle, le nombre de points et la date
relative de derniere mise a jour.

Ce rafraichissement automatique valide la mise a jour des donnees du dashboard.
Il ne doit pas etre confondu avec le module distinct WebSocket/SSE, qui reste a
implementer.

## Export CSV

Le bouton `Export CSV` genere un fichier :

```text
cleartrend-aapl-1m-YYYY-MM-DD.csv
```

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

`change_percent` correspond a la variation entre l'ouverture et la cloture de
la bougie.

## Export JSON

Le bouton `Export JSON` genere un document versionne :

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

Chaque entree de `candles` contient les valeurs OHLCV et la variation de la
bougie.

Les fichiers sont generes localement dans le navigateur a partir des donnees
deja authentifiees. Aucun fichier temporaire n'est stocke sur le serveur.

## Etats geres

Le graphique gere :

- chargement ;
- erreur de recuperation ;
- absence de donnees ;
- absence de volume ;
- boutons d'export desactives sans donnees ;
- preservation du graphique lors d'un echec de rafraichissement en arriere-plan.

## Responsive et accessibilite

Sur mobile :

- les controles sont repartis sur plusieurs lignes ;
- les boutons d'export utilisent toute la largeur disponible ;
- le graphique utilise un format compact ;
- le tooltip souris est masque pour eviter une interaction tactile incoherente.

Les controles utilisent des boutons natifs, `aria-pressed` pour les periodes et
des labels accessibles pour les visualisations et les exports.

## Fichiers principaux

```text
web/src/components/AssetChart.tsx
web/src/components/DashboardClient.tsx
web/src/lib/analysis-data.ts
web/src/lib/chart-analytics.ts
web/src/app/api/assets/candles/route.ts
analysis/src/market_data_views.py
tests/scripts/test-chart-export.mjs
```

## Tests automatises

Commande :

```bash
make test-analytics-dashboard
```

Le test verifie :

- les colonnes CSV ;
- les lignes OHLCV ;
- la variation en pourcentage ;
- les valeurs absentes ;
- le format et la version JSON ;
- les metadonnees du graphique ;
- le nom du fichier exporte.

Verification globale :

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T web npm run lint
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T web npm run build
```

## Test manuel conseille

1. ouvrir `/dashboard` avec un compte connecte ;
2. selectionner `AAPL` ;
3. parcourir les periodes `1D`, `1W`, `1M`, `3M`, `1Y` ;
4. limiter la vue avec les champs de debut et de fin ;
5. sur desktop, survoler plusieurs points de la courbe ;
6. passer de `Price` a `Volume` ;
7. verifier le graphique en barres et son tooltip ;
8. exporter le CSV et controler les colonnes et la periode filtree ;
9. exporter le JSON et controler `format`, `version`, `symbol` et `range` ;
10. changer d'asset et verifier que le nom et le contenu des exports changent ;
11. reduire la fenetre pour verifier les controles mobiles.

## Limites assumees

- Le dashboard utilise du polling et non WebSocket/SSE.
- Les exports disponibles sont CSV et JSON, pas PDF.
- Le filtre debut/fin reste borne par la periode produit chargee.
- Le sentiment, le trend score et les recommandations seront relies au module
  ML plus tard.

Ces limites ne retirent aucun des parcours principaux du module : plusieurs
visualisations interactives, filtres, periodes, mises a jour et export sont
disponibles.
