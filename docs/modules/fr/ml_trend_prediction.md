# Module Major personnalisé - ML Trend Prediction

## Statut

Implémentation terminée pour la régression, Reddit RSS, ApeWisdom, la fusion,
l'API et le dashboard.

L'intégration Gemma a été testée avec une clé réelle. Un cycle quotidien
complet sur les sept assets reste à confirmer après renouvellement du quota:
les premiers appels ont fonctionné, puis Gemma a retourné HTTP `429`.

## Pourquoi ce module

Le sujet autorise un module Major personnalisé s'il est substantiel, pertinent,
techniquement complexe et correctement justifié dans le README.

ClearTrend analyse des marchés financiers. Un moteur de tendance multi-source
apporte donc une fonction centrale au produit:

- estimation de prix à plusieurs horizons;
- tendance normalisée et comparable entre assets;
- analyse de discussions récentes;
- mesure de l'attention publique;
- niveau de confiance explicable;
- fonctionnement dégradé quand une source externe ne répond pas.

Ce module ne prétend pas être le module officiel "Recommendation system using
machine learning". Il ne personnalise pas ses sorties selon le comportement
utilisateur.

## Périmètre

Les prédictions sont limitées aux assets disposant de cinq années d'historique:

| Asset | Ticker marché | Alias social |
|---|---|---|
| S&P 500 | `^GSPC` / `GSPC` | `SPY`, `S&P 500` |
| Nasdaq Composite | `^IXIC` / `IXIC` | `QQQ`, `Nasdaq Composite` |
| Bitcoin | `BTC-USD` | `BTC`, `Bitcoin`, `BTC.X` |
| Ethereum | `ETH-USD` | `ETH`, `Ethereum`, `ETH.X` |
| Or | `GC=F` | `GLD`, `gold` |
| Alphabet | `GOOGL` | `GOOGL`, `Alphabet stock` |
| Nvidia | `NVDA` | `NVDA`, `Nvidia` |

Les horizons dépendent du calendrier de l'asset:

| Horizon | Marchés avec clôture | Crypto 24 h/24 |
|---|---:|---:|
| `1D` | 1 jour de cotation | 1 jour calendaire |
| `1W` | 5 jours de cotation | 7 jours calendaires |
| `1M` | 21 jours de cotation | 30 jours calendaires |

Bitcoin et Ethereum cotent tous les jours. Leurs horizons incluent donc les
samedis et dimanches. Les actions, indices et contrats sur l'or utilisent les
jours de cotation disponibles dans leur historique.

## Architecture

Le pipeline est séparé en quatre méthodes.

L'orchestration et le stockage sont isolés dans
`analysis/src/ml/prediction_store.py`. Ce fichier ne constitue pas un cinquième
algorithme: il planifie les quatre méthodes et persiste leurs sorties.

### 1. Régression historique

Fichier: `analysis/src/ml/historical_regression.py`.

Le modèle prédit le log-rendement futur:

```text
log(prix futur / prix actuel)
```

Le prix estimé est ensuite:

```text
prix actuel * exp(rendement prédit)
```

Le modèle utilise `Ridge Regression` avec une régularisation `alpha=100`.
Cette valeur a été retenue après comparaison chronologique avec des valeurs
Ridge plus faibles et une régression Gradient Boosting.

Ridge a été conservé car il est:

- plus stable sur le petit dataset;
- explicable;
- rapide à entraîner;
- moins sensible aux variables corrélées;
- globalement meilleur sur l'erreur de prix du benchmark actuel.

Un modèle distinct est entraîné pour chaque couple asset/horizon. Par exemple,
le modèle `BTC-USD/1W` n'apprend jamais avec l'historique de NVDA ou de l'or.
Cette séparation est nécessaire car les niveaux de volatilité, calendriers,
volumes et comportements de marché sont très différents.

Variables historiques, calculées sur les observations quotidiennes propres au
calendrier de chaque asset:

- rendements sur 1, 2, 5, 10 et 20 observations;
- distance aux moyennes mobiles 5, 10, 20 et 50;
- volatilité sur 5 et 20 observations;
- amplitude High/Low;
- variation et niveau relatif du volume;
- RSI sur 14 observations.

### Validation temporelle

`TimeSeriesSplit` conserve l'ordre chronologique. Le modèle apprend uniquement
sur le passé et est testé sur des périodes postérieures.

Une validation complémentaire coupe les données environ un mois avant leur fin:

1. entraînement avant la date de coupure;
2. prédiction depuis cette date;
3. comparaison avec le prix réel 1D, 1W ou 1M plus tard.

La réponse expose:

- `directionalAccuracy`;
- erreur absolue moyenne du rendement;
- erreur du baseline sans mouvement;
- dispersion des résidus;
- nombre d'exemples;
- snapshot de validation avec prix prédit et prix réel.

Une précision proche de 50 % ou une erreur supérieure au baseline produit
volontairement une confiance faible.

### Normalisation 0 à 1

Le rendement prédit est comparé à la volatilité habituelle de l'asset et de
l'horizon.

```text
0.0 -> forte tendance baissière
0.5 -> tendance neutre
1.0 -> forte tendance haussière
```

Le rendement est limité à trois fois la volatilité attendue afin qu'une sortie
extrême du modèle ne produise pas un prix absurde.

Le prix estimé reste indicatif. Pour un asset volatil et un horizon mensuel,
l'intervalle peut être large.

### 2. Sentiment Reddit et Gemma

Fichier: `analysis/src/ml/reddit_sentiment.py`.

Flux:

1. recherche de maximum 100 candidats dans le RSS public Reddit;
2. conservation des publications de moins de sept jours;
3. filtrage par aliases de l'asset et vocabulaire marché;
4. suppression des doublons;
5. limite de 50 publications pertinentes;
6. titre limité à 180 caractères;
7. extrait limité à 360 caractères;
8. envoi temporaire à Gemma;
9. réponse JSON structurée.

Sorties:

- sentiment `0..1`;
- accord entre les messages `0..1`;
- nombre de messages haussiers, neutres et baissiers;
- nombre de publications analysées.

Gemma ne produit aucun texte destiné au frontend. Les publications nettoyées
et limitées en taille lui sont envoyées uniquement pour obtenir ces mesures
structurées de sentiment.

La clé n'est jamais exposée au navigateur et ne doit pas être versionnée.

```dotenv
QWEN_API_KEY=...
QWEN_MODEL=gemma3:1b
```

Sans clé, le signal est marqué indisponible et la prédiction historique continue
de fonctionner.

Si Gemma refuse un appel, le snapshot conserve le nombre de publications
collectées dans `collectedPostCount`. Cela permet de distinguer une limite API
d'une absence de messages Reddit, sans multiplier les nouvelles tentatives.

### 3. Attention ApeWisdom

Fichier: `analysis/src/ml/attention_signal.py`.

ApeWisdom fournit notamment:

- mentions actuelles;
- mentions 24 heures auparavant;
- rang actuel;
- rang 24 heures auparavant.

Le score d'attention `0..1` combine le volume de mentions et le rang.

Une hausse du nombre de messages n'est pas considérée comme haussière: un crash
peut aussi provoquer beaucoup de discussions. L'attention sert à augmenter ou
réduire le poids et la confiance du sentiment Gemma.

### 4. Fusion des signaux

Fichier: `analysis/src/ml/trend_ensemble.py`.

Poids de base:

| Horizon | Historique | Sentiment |
|---|---:|---:|
| `1D` | 0.55 | 0.45 |
| `1W` | 0.65 | 0.35 |
| `1M` | 0.80 | 0.20 |

Le poids social est réduit lorsque ApeWisdom montre peu d'attention.

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

- qualité du backtest;
- erreur résiduelle;
- quantité de données;
- accord des publications;
- nombre de publications;
- attention ApeWisdom;
- accord entre historique et sentiment;
- disponibilité des sources.

La confiance est un indice de qualité de la prédiction. Ce n'est pas une
probabilité de gain.

## Entraînement quotidien et partagé

Le calcul n'est jamais lancé par un utilisateur.

Cycle normal:

1. le scheduler vérifie si l'historique daily doit être rafraîchi;
2. les nouveaux CSV daily sont téléchargés;
3. le job ML parcourt les sept assets;
4. chaque asset entraîne indépendamment ses modèles `1D`, `1W` et `1M`;
5. Reddit, Gemma et ApeWisdom sont appelés une seule fois pour cet asset;
6. un snapshot JSON temporaire est écrit;
7. le snapshot remplace atomiquement l'ancien fichier;
8. les clients lisent tous ce même résultat.

La bougie portant la date UTC en cours est exclue de l'entraînement, car Yahoo
peut la fournir avant sa clôture. Le modèle utilise uniquement des daily
terminées. Cela évite qu'une variation intraday partielle soit prise pour le
résultat définitif de la journée.

Répertoire persistant:

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

Le répertoire appartient au volume Docker `analysis_data`. Les prédictions
survivent donc au redémarrage du conteneur.

Un asset est recalculé si au moins une condition est vraie:

- aucun snapshot n'existe;
- le snapshot n'a pas été entraîné aujourd'hui;
- une nouvelle date daily est disponible pour cet asset;
- la version du modèle a changé;
- Gemma vient d'être configuré ou retiré;
- aucune tentative de sentiment n'a encore été enregistrée aujourd'hui.

Le démarrage du serveur constitue la première occasion de remplir les sentiments
manquants. `socialAttemptedAt` est enregistré même si Reddit ne retourne aucun
message ou si Gemma répond `429`. Une seule tentative est donc effectuée par
asset et par jour; la suivante attend le job quotidien. Un refresh navigateur
ou un redémarrage supplémentaire le même jour ne lance aucun appel.

Le verrou du processus empêche deux jobs ML locaux de tourner en parallèle. Les
fichiers sont remplacés atomiquement: un client voit soit l'ancien résultat
complet, soit le nouveau, jamais un JSON partiellement écrit.

## API

### Assets supportés

```http
GET /ml/assets
```

### Analyse

```http
GET /ml/analyse/NVDA
GET /ml/analyse/NVDA?horizon=1W
```

Cet endpoint lit uniquement le snapshot persisté. Il ne relance aucun calcul.

### État du cache

```http
GET /ml/status
```

Pour chaque asset, cette route indique:

- disponibilité du snapshot;
- date de la daily utilisée;
- date d'entraînement;
- état courant ou obsolète.

Le frontend utilise une route authentifiée:

```http
GET /api/ml/analyse?symbol=NVDA&horizon=1D
```

## Dashboard

Les tuiles Tendance et Sentiment ne sont plus des placeholders.

La tuile Tendance affiche:

- label bearish, neutral ou bullish;
- score;
- horizon;
- prix estimé;
- confiance.

La tuile Sentiment affiche:

- direction lisible et score Gemma sur 100;
- nombre de messages;
- accord entre les messages.
- mentions ApeWisdom et variation sur 24 heures.

Les deux tuiles sont regroupées dans un cadre `Analyse IA`. Ce cadre est
absent pour les assets hors du périmètre ML. Dans la watchlist, une pastille
`IA` distingue les sept assets disposant d'une analyse calculée en backend.
Ces sept assets sont présents dans la watchlist par défaut de tous les
utilisateurs et restent regroupés en tête, quel que soit le tri choisi.

Les valeurs sont explicables au survol:

- le score rappelle que `0` signifie plutôt vendre, `50` attendre et `100`
  plutôt acheter, sans représenter une probabilité;
- l'accord indique seulement si les messages vont dans la même direction;
- les mentions mesurent l'activité autour du sujet, pas une direction.

Les assets hors du périmètre affichent `Non disponible`.

## Cache et coût

- un calcul planifié par asset et par jour;
- aucun appel externe lors d'une requête utilisateur;
- sentiment Reddit/Gemma garde en mémoire 30 minutes pendant un même job;
- attention ApeWisdom gardée en mémoire 15 minutes pendant un même job;
- maximum 100 candidats récupérés par recherche;
- maximum 50 publications pertinentes envoyées à Gemma;
- maximum 180 caractères de titre;
- maximum 360 caractères d'extrait.

Les trois horizons réutilisent le même sentiment récent. Tous les utilisateurs
réutilisent ensuite le snapshot daily au lieu d'appeler Gemma.

## Tests

Tests Python:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T analysis python -m unittest discover -s tests -v
```

Ils vérifient:

- régression et validation chronologique;
- parsing et filtrage RSS;
- rejet d'un faux résultat Google;
- normalisation de l'attention;
- influence de l'attention sur le poids social.
- isolation des snapshots par asset;
- absence de second entraînement pour un snapshot courant;
- ordre refresh daily puis job ML.

Test API du snapshot partagé:

```bash
curl "http://localhost:8000/ml/analyse/NVDA"
```

Script d'intégration:

```bash
node tests/scripts/test-ml-analysis.mjs
```

Contrôles frontend:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run lint

docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npx tsc --noEmit
```

## Scénario de validation

1. Configurer `QWEN_API_KEY`.
2. Recréer le service `analysis`.
3. Sélectionner NVDA sur le dashboard.
4. Montrer le résultat `1D`.
5. Passer le chart à `1W`, puis `1M`.
6. Montrer score, prix estimé, intervalle et confiance.
7. Montrer le nombre de messages et leur accord.
8. Rafraîchir plusieurs fois la page et montrer que `trainedAt` ne change pas.
9. Montrer `/ml/status` et les sept snapshots distincts.
10. Expliquer une confiance basse avec les métriques du backtest.

## Limites assumées

- Les marchés restent très difficiles à prédire.
- Le prix estimé n'est pas un conseil financier.
- Reddit n'est pas représentatif de tous les investisseurs.
- ApeWisdom mesure l'attention, pas la direction.
- Le flux RSS peut changer ou devenir indisponible.
- Gemma peut mal classer un message ambigu.
- Les poids sont explicites et non appris, faute d'historique social aligné avec
  les prix.

Une Random Forest de fusion ne serait défendable qu'après plusieurs semaines ou
mois de stockage des trois signaux et de leurs résultats réels. Elle n'est donc
pas utilisée dans cette première version.
