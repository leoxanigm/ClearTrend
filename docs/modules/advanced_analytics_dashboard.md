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

Les tuiles `Tendance` et `Sentiment` sont maintenant alimentees par le module ML.
Elles enrichissent le dashboard, mais ne sont pas necessaires pour justifier ce
module : la validation repose sur les graphiques, les filtres, le
rafraichissement et les exports.

## Architecture generale

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
  lecture des caches OHLCV et metadonnees
```

Le navigateur ne contacte jamais directement FastAPI. Les routes Next.js
verifient d'abord la session utilisateur ou la cle API, puis transmettent une
requete limitee aux symboles et periodes acceptes.

Cette separation permet :

- de ne pas exposer l'adresse du microservice `analysis` au client ;
- de centraliser l'authentification dans le backend web ;
- de normaliser les donnees avant leur utilisation par React ;
- de conserver FastAPI specialise dans les donnees financieres.

## Parcours utilisateur

Depuis le dashboard, l'utilisateur peut :

1. choisir un asset dans la watchlist ;
2. choisir une periode ;
3. afficher le prix sous forme de courbe ;
4. afficher les valeurs OHLC sous forme de bougies ;
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

Le graphique est dessine directement en SVG par React. Aucune bibliotheque de
visualisation externe n'est utilisee.

Ce choix donne un controle precis sur les axes, la largeur des bougies, les
tooltips et le rendu mobile. Il evite aussi d'ajouter une dependance lourde pour
deux representations financieres bien definies. En contrepartie, les calculs de
coordonnees, de domaines et de placement des tooltips sont maintenus dans le
projet.

### Courbe de prix

La vue `Price` affiche :

- la cloture de chaque bougie ;
- une ligne et une zone coloree ;
- les axes temporel et financier ;
- la performance de la periode ;
- un tooltip avec la date et le prix.

### Bougies OHLC

La vue `Candles` utilise les memes donnees et affiche :

- une meche entre le minimum `low` et le maximum `high` ;
- un corps entre l'ouverture `open` et la cloture `close` ;
- une bougie verte lorsque la cloture est superieure ou egale a l'ouverture ;
- une bougie rouge lorsque la cloture est inferieure a l'ouverture ;
- un tooltip compact avec la date et les libelles complets `Ouverture`,
  `Plus haut`, `Plus bas` et `Cloture`.

La granularite vient directement de la periode choisie :

```text
1D -> 5 minutes
1W -> 1 heure
1M / 3M / 1Y -> 1 jour
```

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
- type de visualisation `Price` ou `Candles` ;
- periode de performance de la watchlist.

Les changements d'asset et de periode rechargent les bougies correspondantes.
Le filtre debut/fin travaille ensuite localement sur ces bougies. Pour `1D` et
`1W`, il accepte aussi l'heure. Le graphique, le nombre de points et les exports
utilisent uniquement les bougies restantes.

Le filtrage local a ete choisi parce que la periode produit est deja bornee et
chargee dans le navigateur. Modifier une date ne provoque donc pas une nouvelle
requete serveur et le resultat est immediat. Ce filtre ne permet toutefois pas
de demander une periode arbitraire situee en dehors de la plage chargee.

Les snapshots `1D` et les performances de watchlist sont charges par lots de
20 symboles, avec deux lots simultanes. Les requetes identiques en cours sont
partagees entre utilisateurs et les resultats sont gardes 30 secondes cote
`web`. Le selecteur affiche `...` pendant le chargement; `N/A` indique ensuite
une absence reelle de donnees pour l'asset et la periode.

## Rafraichissement automatique

Le dashboard utilise la frequence configuree par l'administrateur, avec une
valeur minimale d'une minute.

Fonctionnement :

1. le graphique charge les bougies a son ouverture ;
2. il programme le prochain controle du cache `analysis` ;
3. il recharge les donnees quand une nouvelle version est disponible ;
4. en cas d'echec en arriere-plan, il conserve le graphique deja visible ;
5. lorsque l'onglet redevient visible, il controle immediatement les donnees.

Le footer affiche la source, l'intervalle, le nombre de points, la date de la
derniere bougie de marche et la date relative de mise a jour du cache. Cette
separation evite de confondre une derniere seance du vendredi avec un cache
rafraichi ou un export effectue pendant le week-end.

Il affiche aussi la prochaine ouverture reguliere du marche americain. Le
calcul utilise 9h30 a New York, ignore les week-ends et les principaux jours
feries NYSE, puis affiche le resultat dans le fuseau local du navigateur.

Ce rafraichissement automatique valide la mise a jour des donnees du dashboard.
Il ne doit pas etre confondu avec le module distinct WebSocket/SSE, qui reste a
implementer.

Le controle leger utilise d'abord l'endpoint de metadonnees
`/api/assets/candles/meta`. Les bougies completes ne sont rechargees que lorsque
`updatedAt` a change. Cela evite de transferer plusieurs fois le meme historique.

## Export CSV

Le bouton `Export CSV` genere un fichier :

```text
cleartrend-aapl-1m-YYYY-MM-DD.csv
```

La date du nom de fichier est la date d'export. La date de chaque point de
marche reste presente dans la colonne `datetime`.

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

Cette approche evite un stockage serveur inutile et garantit que l'export
correspond exactement au filtre actuellement visible.

## Etats geres

Le graphique gere :

- chargement ;
- erreur de recuperation ;
- absence de donnees ;
- boutons d'export desactives sans donnees ;
- preservation du graphique lors d'un echec de rafraichissement en arriere-plan.

## Responsive et accessibilite

Sur mobile :

- les periodes `1D` a `1Y` restent toujours visibles sous le titre ;
- un bouton chevron replie par defaut les dates, le type de graphique et les
  exports ;
- les controles sont repartis sur plusieurs lignes ;
- les boutons d'export utilisent toute la largeur disponible ;
- le graphique utilise un format compact ;
- le tooltip souris est masque pour eviter une interaction tactile incoherente.

Les controles utilisent des boutons natifs, `aria-pressed` pour les periodes et
des labels accessibles pour les visualisations et les exports.

## Fichiers principaux

| Fichier | Role |
|---|---|
| `web/src/components/AssetChart.tsx` | Etat du graphique, SVG, interactions, filtres, polling et telechargement |
| `web/src/components/DashboardClient.tsx` | Selection de l'asset, periode active et integration dans le dashboard |
| `web/src/lib/analysis-data.ts` | Contrat des bougies, validation, normalisation et appels au service `analysis` |
| `web/src/lib/chart-analytics.ts` | Generation CSV/JSON et noms de fichiers |
| `web/src/lib/chart-layout.ts` | Calcul robuste de la largeur des bougies |
| `web/src/lib/market-calendar.ts` | Calcul de la prochaine ouverture reguliere americaine |
| `web/src/app/api/assets/candles/route.ts` | Endpoint authentifie retournant les bougies |
| `web/src/app/api/assets/candles/meta/route.ts` | Endpoint leger de controle de fraicheur |
| `analysis/src/market_data_views.py` | Choix des caches et conversion en bougies OHLCV |
| `analysis/src/market_data_history.py` | Lecture et composition des historiques |
| `analysis/src/scheduler.py` | Mise a jour periodique des caches |
| `tests/scripts/test-chart-export.mjs` | Tests des exports, du calendrier et du layout |

La largeur des bougies utilise l'espacement median entre les points. En `1D`,
elle est plafonnee pour eviter des bougies trop larges en debut de seance ou
lorsque le fournisseur retourne momentanement peu de points.

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
- le nom du fichier exporte ;
- la prochaine ouverture avant et apres 9h30 a New York ;
- le passage des week-ends, d'un jour ferie NYSE et du changement
  heure d'hiver/heure d'ete.

Le script couvre les calculs purs les plus sensibles. Le rendu visuel et les
interactions souris/tactiles restent verifies manuellement.

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
6. passer de `Price` a `Candles` ;
7. verifier les meches high/low, les corps open/close et le tooltip OHLC ;
8. exporter le CSV et controler les colonnes et la periode filtree ;
9. exporter le JSON et controler `format`, `version`, `symbol` et `range` ;
10. changer d'asset et verifier que le nom et le contenu des exports changent ;
11. reduire la fenetre pour verifier les controles mobiles.

## Limites assumees

- Le dashboard utilise du polling et non WebSocket/SSE.
- Les exports disponibles sont CSV et JSON, pas PDF.
- Le filtre debut/fin reste borne par la periode produit chargee.
- Les visualisations sont une courbe et des bougies OHLC ; il n'existe pas de
  graphique en barres ou en secteurs.
- La prochaine ouverture utilise le calendrier regulier americain. Cette
  indication n'est pas adaptee au Bitcoin et a Ethereum, qui cotent 24 h/24, ni
  a tous les calendriers internationaux ou contrats futures.
- Les tests automatises ne realisent pas de comparaison de captures d'ecran
  multi-navigateurs.

Ces limites ne retirent aucun des parcours principaux du module : plusieurs
visualisations interactives, filtres, periodes, mises a jour et export sont
disponibles.
