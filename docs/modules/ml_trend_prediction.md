# Module Major personnalise - ML Trend Prediction

## Statut

Implementation terminee pour la regression, Reddit RSS, ApeWisdom, la fusion,
l'API et le dashboard.

Le module ne doit pas encore etre annonce comme valide tant qu'un appel reel
Gemini n'a pas ete teste avec `GEMINI_API_KEY`.

## Pourquoi ce module

Le sujet autorise un module Major personnalise s'il est substantiel, pertinent,
techniquement complexe et correctement justifie dans le README.

ClearTrend analyse des marches financiers. Un moteur de tendance multi-source
apporte donc une fonction centrale au produit:

- estimation de prix a plusieurs horizons;
- tendance normalisee et comparable entre assets;
- analyse de discussions recentes;
- mesure de l'attention publique;
- niveau de confiance explicable;
- fonctionnement degrade quand une source externe ne repond pas.

Ce module ne pretend pas etre le module officiel "Recommendation system using
machine learning". Il ne personnalise pas ses sorties selon le comportement
utilisateur.

## Perimetre

Les predictions sont limitees aux assets disposant de cinq annees d'historique:

| Asset | Ticker marche | Alias social |
|---|---|---|
| S&P 500 | `^GSPC` / `GSPC` | `SPY`, `S&P 500` |
| Nasdaq Composite | `^IXIC` / `IXIC` | `QQQ`, `Nasdaq Composite` |
| Bitcoin | `BTC-USD` | `BTC`, `Bitcoin`, `BTC.X` |
| Ethereum | `ETH-USD` | `ETH`, `Ethereum`, `ETH.X` |
| Or | `GC=F` | `GLD`, `gold` |
| Alphabet | `GOOGL` | `GOOGL`, `Alphabet stock` |
| Nvidia | `NVDA` | `NVDA`, `Nvidia` |

Les horizons sont:

| Horizon | Sessions utilisees |
|---|---:|
| `1D` | 1 |
| `1W` | 5 |
| `1M` | 21 |

## Architecture

Le pipeline est separe en quatre methodes.

L'orchestration et le stockage sont isoles dans
`analysis/src/ml/prediction_store.py`. Ce fichier ne constitue pas un cinquieme
algorithme: il planifie les quatre methodes et persiste leurs sorties.

### 1. Regression historique

Fichier: `analysis/src/ml/historical_regression.py`.

Le modele predit le log-rendement futur:

```text
log(prix futur / prix actuel)
```

Le prix estime est ensuite:

```text
prix actuel * exp(rendement predit)
```

Le modele utilise `Ridge Regression` avec une regularisation `alpha=100`.
Cette valeur a ete retenue apres comparaison chronologique avec des valeurs
Ridge plus faibles et une regression Gradient Boosting.

Ridge a ete conserve car il est:

- plus stable sur le petit dataset;
- explicable;
- rapide a entrainer;
- moins sensible aux variables correlees;
- globalement meilleur sur l'erreur de prix du benchmark actuel.

Un modele distinct est entraine pour chaque couple asset/horizon. Par exemple,
le modele `BTC-USD/1W` n'apprend jamais avec l'historique de NVDA ou de l'or.
Cette separation est necessaire car les niveaux de volatilite, calendriers,
volumes et comportements de marche sont tres differents.

Variables historiques:

- rendements sur 1, 2, 5, 10 et 20 sessions;
- distance aux moyennes mobiles 5, 10, 20 et 50;
- volatilite sur 5 et 20 sessions;
- amplitude High/Low;
- variation et niveau relatif du volume;
- RSI sur 14 sessions.

### Validation temporelle

`TimeSeriesSplit` conserve l'ordre chronologique. Le modele apprend uniquement
sur le passe et est teste sur des periodes posterieures.

Une validation complementaire coupe les donnees environ un mois avant leur fin:

1. entrainement avant la date de coupure;
2. prediction depuis cette date;
3. comparaison avec le prix reel 1D, 1W ou 1M plus tard.

La reponse expose:

- `directionalAccuracy`;
- erreur absolue moyenne du rendement;
- erreur du baseline sans mouvement;
- dispersion des residus;
- nombre d'exemples;
- snapshot de validation avec prix predit et prix reel.

Une precision proche de 50 % ou une erreur superieure au baseline produit
volontairement une confiance faible.

### Normalisation 0 a 1

Le rendement predit est compare a la volatilite habituelle de l'asset et de
l'horizon.

```text
0.0 -> forte tendance baissiere
0.5 -> tendance neutre
1.0 -> forte tendance haussiere
```

Le rendement est limite a trois fois la volatilite attendue afin qu'une sortie
extreme du modele ne produise pas un prix absurde.

Le prix estime reste indicatif. Pour un asset volatil et un horizon mensuel,
l'intervalle peut etre large.

### 2. Sentiment Reddit et Gemini

Fichier: `analysis/src/ml/reddit_sentiment.py`.

Flux:

1. recherche de maximum 100 candidats dans le RSS public Reddit;
2. conservation des publications de moins de sept jours;
3. filtrage par aliases de l'asset et vocabulaire marche;
4. suppression des doublons;
5. limite de 50 publications pertinentes;
6. titre limite a 180 caracteres;
7. extrait limite a 360 caracteres;
8. envoi temporaire a Gemini;
9. reponse JSON structuree.

Sorties:

- sentiment `0..1`;
- accord entre les messages `0..1`;
- nombre de messages haussiers, neutres et baissiers;
- resume court en francais, anglais et espagnol dans le meme appel;
- nombre de publications analysees.

La cle n'est jamais exposee au navigateur et ne doit pas etre versionnee.

```dotenv
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite
```

Sans cle, le signal est marque indisponible et la prediction historique continue
de fonctionner.

### 3. Attention ApeWisdom

Fichier: `analysis/src/ml/attention_signal.py`.

ApeWisdom fournit notamment:

- mentions actuelles;
- mentions 24 heures auparavant;
- rang actuel;
- rang 24 heures auparavant.

Le score d'attention `0..1` combine le volume de mentions et le rang.

Une hausse du nombre de messages n'est pas consideree comme haussiere: un crash
peut aussi provoquer beaucoup de discussions. L'attention sert a augmenter ou
reduire le poids et la confiance du sentiment Gemini.

### 4. Fusion des signaux

Fichier: `analysis/src/ml/trend_ensemble.py`.

Poids de base:

| Horizon | Historique | Sentiment |
|---|---:|---:|
| `1D` | 0.55 | 0.45 |
| `1W` | 0.65 | 0.35 |
| `1M` | 0.80 | 0.20 |

Le poids social est reduit lorsque ApeWisdom montre peu d'attention.

Le score final devient:

```text
score = somme(score source * poids source) / somme(poids disponibles)
```

Labels:

| Score | Label |
|---|---|
| `<= 0.43` | bearish |
| `0.43 .. 0.57` | neutral |
| `>= 0.57` | bullish |

La confiance combine:

- qualite du backtest;
- erreur residuelle;
- quantite de donnees;
- accord des publications;
- nombre de publications;
- attention ApeWisdom;
- accord entre historique et sentiment;
- disponibilite des sources.

La confiance est un indice de qualite de la prediction. Ce n'est pas une
probabilite de gain.

## Entrainement quotidien et partage

Le calcul n'est jamais lance par un utilisateur.

Cycle normal:

1. le scheduler verifie si l'historique daily doit etre rafraichi;
2. les nouveaux CSV daily sont telecharges;
3. le job ML parcourt les sept assets;
4. chaque asset entraine independamment ses modeles `1D`, `1W` et `1M`;
5. Reddit, Gemini et ApeWisdom sont appeles une seule fois pour cet asset;
6. un snapshot JSON temporaire est ecrit;
7. le snapshot remplace atomiquement l'ancien fichier;
8. les clients lisent tous ce meme resultat.

La bougie portant la date UTC en cours est exclue de l'entrainement, car Yahoo
peut la fournir avant sa cloture. Le modele utilise uniquement des daily
terminees. Cela evite qu'une variation intraday partielle soit prise pour le
resultat definitif de la journee.

Repertoire persistant:

```text
/app/data/ml_predictions/
  BTC-USD.json
  ETH-USD.json
  GC=F.json
  GOOGL.json
  GSPC.json
  IXIC.json
  NVDA.json
```

Le repertoire appartient au volume Docker `analysis_data`. Les predictions
survivent donc au redemarrage du conteneur.

Un asset est recalcule si au moins une condition est vraie:

- aucun snapshot n'existe;
- le snapshot n'a pas ete entraine aujourd'hui;
- une nouvelle date daily est disponible pour cet asset;
- la version du modele a change;
- Gemini vient d'etre configure ou retire.

Il est ignore lorsque toutes ces informations sont deja courantes. Cela evite
un nouvel entrainement apres un refresh navigateur ou un simple redemarrage du
service.

Le verrou du processus empeche deux jobs ML locaux de tourner en parallele. Les
fichiers sont remplaces atomiquement: un client voit soit l'ancien resultat
complet, soit le nouveau, jamais un JSON partiellement ecrit.

## API

### Assets supportes

```http
GET /ml/assets
```

### Analyse

```http
GET /ml/analyse/NVDA
GET /ml/analyse/NVDA?horizon=1W
```

Cet endpoint lit uniquement le snapshot persiste. Il ne relance aucun calcul.

### Etat du cache

```http
GET /ml/status
```

Pour chaque asset, cette route indique:

- disponibilite du snapshot;
- date de la daily utilisee;
- date d'entrainement;
- etat courant ou obsolete.

Le frontend utilise une route authentifiee:

```http
GET /api/ml/analyse?symbol=NVDA&horizon=1D
```

## Dashboard

Les tuiles Tendance et Sentiment ne sont plus des placeholders.

La tuile Tendance affiche:

- label bearish, neutral ou bullish;
- score;
- horizon;
- prix estime;
- confiance.

La tuile Sentiment affiche:

- direction lisible et score Gemini sur 100;
- nombre de messages;
- accord entre les messages.
- mentions ApeWisdom et variation sur 24 heures.

Les deux tuiles sont regroupees dans un cadre `Analyse IA`. Ce cadre est
absent pour les assets hors du perimetre ML. Dans la watchlist, une pastille
`IA` distingue les sept assets disposant d'une analyse calculee en backend.

Les valeurs sont explicables au survol:

- le score rappelle que `0` signifie plutot vendre, `50` attendre et `100`
  plutot acheter, sans representer une probabilite;
- l'accord indique seulement si les messages vont dans la meme direction;
- les mentions mesurent l'activite autour du sujet, pas une direction;
- le score affiche aussi le resume court produit par Gemini dans la langue
  active de l'interface.

Les assets hors du perimetre affichent `Non disponible`.

## Cache et cout

- un calcul planifie par asset et par jour;
- aucun appel externe lors d'une requete utilisateur;
- sentiment Reddit/Gemini garde en memoire 30 minutes pendant un meme job;
- attention ApeWisdom gardee en memoire 15 minutes pendant un meme job;
- maximum 100 candidats recuperes par recherche;
- maximum 50 publications pertinentes envoyees a Gemini;
- maximum 180 caracteres de titre;
- maximum 360 caracteres d'extrait.

Les trois horizons reutilisent le meme sentiment recent. Tous les utilisateurs
reutilisent ensuite le snapshot daily au lieu d'appeler Gemini.

## Tests

Tests Python:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T analysis python -m unittest discover -s tests -v
```

Ils verifient:

- regression et validation chronologique;
- parsing et filtrage RSS;
- rejet d'un faux resultat Google;
- normalisation de l'attention;
- influence de l'attention sur le poids social.
- isolation des snapshots par asset;
- absence de second entrainement pour un snapshot courant;
- ordre refresh daily puis job ML.

Test API du snapshot partage:

```bash
curl "http://localhost:8000/ml/analyse/NVDA"
```

Script d'integration:

```bash
node tests/scripts/test-ml-analysis.mjs
```

Controles frontend:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run lint

docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npx tsc --noEmit
```

## Scenario de validation

1. Configurer `GEMINI_API_KEY`.
2. Recreer le service `analysis`.
3. Selectionner NVDA sur le dashboard.
4. Montrer le resultat `1D`.
5. Passer le chart a `1W`, puis `1M`.
6. Montrer score, prix estime, intervalle et confiance.
7. Montrer le nombre de messages et leur accord.
8. Rafraichir plusieurs fois la page et montrer que `trainedAt` ne change pas.
9. Montrer `/ml/status` et les sept snapshots distincts.
10. Expliquer une confiance basse avec les metriques du backtest.

## Limites assumees

- Les marches restent tres difficiles a predire.
- Le prix estime n'est pas un conseil financier.
- Reddit n'est pas representatif de tous les investisseurs.
- ApeWisdom mesure l'attention, pas la direction.
- Le flux RSS peut changer ou devenir indisponible.
- Gemini peut mal classer un message ambigu.
- Les poids sont explicites et non appris, faute d'historique social aligne avec
  les prix.

Une Random Forest de fusion ne serait defendable qu'apres plusieurs semaines ou
mois de stockage des trois signaux et de leurs resultats reels. Elle n'est donc
pas utilisee dans cette premiere version.
