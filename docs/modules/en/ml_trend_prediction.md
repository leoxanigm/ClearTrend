# Custom Major Module - ML Trend Prediction

## Status

Implementation is complete for regression, Reddit RSS, ApeWisdom, fusion, the
API, and the dashboard.

The Gemma integration was tested with a real key. A full daily cycle over the
seven assets still needs confirmation after quota renewal: the first calls
worked, then Gemma returned HTTP `429`.

## Why This Module

The subject allows a custom Major module if it is substantial, relevant,
technically complex, and properly justified in the README.

ClearTrend analyzes financial markets. A multi-source trend engine therefore
brings a core product feature:

- price estimation across several horizons;
- normalized and comparable trend between assets;
- analysis of recent discussions;
- measurement of public attention;
- explainable confidence level;
- degraded operation when an external source does not respond.

This module does not claim to be the official "Recommendation system using
machine learning" module. It does not personalize its output according to user
behavior.

## Scope

Predictions are limited to assets with five years of history:

| Asset | Market ticker | Social alias |
|---|---|---|
| S&P 500 | `^GSPC` / `GSPC` | `SPY`, `S&P 500` |
| Nasdaq Composite | `^IXIC` / `IXIC` | `QQQ`, `Nasdaq Composite` |
| Bitcoin | `BTC-USD` | `BTC`, `Bitcoin`, `BTC.X` |
| Ethereum | `ETH-USD` | `ETH`, `Ethereum`, `ETH.X` |
| Gold | `GC=F` | `GLD`, `gold` |
| Alphabet | `GOOGL` | `GOOGL`, `Alphabet stock` |
| Nvidia | `NVDA` | `NVDA`, `Nvidia` |

Horizons depend on the asset calendar:

| Horizon | Markets with closing sessions | 24/7 crypto |
|---|---:|---:|
| `1D` | 1 trading day | 1 calendar day |
| `1W` | 5 trading days | 7 calendar days |
| `1M` | 21 trading days | 30 calendar days |

Bitcoin and Ethereum trade every day. Their horizons therefore include
Saturdays and Sundays. Stocks, indexes, and gold contracts use the trading days
available in their history.

## Architecture

The pipeline is split into four methods.

Orchestration and storage are isolated in
`analysis/src/ml/prediction_store.py`. This file is not a fifth algorithm: it
schedules the four methods and persists their outputs.

### 1. Historical Regression

File: `analysis/src/ml/historical_regression.py`.

The model predicts the future log return:

```text
log(future price / current price)
```

The estimated price is then:

```text
current price * exp(predicted return)
```

The model uses `Ridge Regression` with `alpha=100` regularization. This value
was selected after chronological comparison with lower Ridge values and a
Gradient Boosting regression.

Ridge was kept because it is:

- more stable on the small dataset;
- explainable;
- quick to train;
- less sensitive to correlated variables;
- overall better on the current benchmark's price error.

A distinct model is trained for each asset/horizon pair. For example, the
`BTC-USD/1W` model never learns from NVDA or gold history. This separation is
necessary because volatility levels, calendars, volumes, and market behaviors
are very different.

Historical features, computed on daily observations specific to each asset's
calendar:

- returns over 1, 2, 5, 10, and 20 observations;
- distance to moving averages 5, 10, 20, and 50;
- volatility over 5 and 20 observations;
- High/Low amplitude;
- volume variation and relative volume level;
- RSI over 14 observations.

### Time Validation

`TimeSeriesSplit` preserves chronological order. The model learns only from the
past and is tested on later periods.

An additional validation cuts the data roughly one month before its end:

1. training before the cutoff date;
2. prediction from that date;
3. comparison with the real price 1D, 1W, or 1M later.

The response exposes:

- `directionalAccuracy`;
- mean absolute return error;
- no-movement baseline error;
- residual dispersion;
- example count;
- validation snapshot with predicted and real prices.

Accuracy close to 50% or error greater than the baseline intentionally produces
low confidence.

### 0 to 1 Normalization

The predicted return is compared with the asset and horizon's usual volatility.

```text
0.0 -> strong bearish trend
0.5 -> neutral trend
1.0 -> strong bullish trend
```

The return is capped at three times expected volatility so an extreme model
output does not produce an absurd price.

The estimated price remains indicative. For a volatile asset and a monthly
horizon, the interval can be wide.

### 2. Reddit and Gemma Sentiment

File: `analysis/src/ml/reddit_sentiment.py`.

Flow:

1. search for at most 100 candidates in the public Reddit RSS;
2. keep posts less than seven days old;
3. filter by asset aliases and market vocabulary;
4. remove duplicates;
5. limit to 50 relevant posts;
6. limit title to 180 characters;
7. limit excerpt to 360 characters;
8. send temporarily to Gemma;
9. receive a structured JSON response.

Outputs:

- sentiment `0..1`;
- agreement between messages `0..1`;
- bullish, neutral, and bearish message counts;
- number of analyzed posts.

Gemma does not produce any frontend-facing text. Cleaned and size-limited posts
are sent only to obtain these structured sentiment measures.

The key is never exposed to the browser and must not be committed.

```dotenv
Gemma_API_KEY=...
Gemma_MODEL=Gemma-2.5-flash-lite
```

Without a key, the signal is marked unavailable and historical prediction
continues to work.

If Gemma rejects a call, the snapshot keeps the number of collected posts in
`collectedPostCount`. This makes it possible to distinguish an API limit from
the absence of Reddit messages without multiplying retries.

### 3. ApeWisdom Attention

File: `analysis/src/ml/attention_signal.py`.

ApeWisdom provides in particular:

- current mentions;
- mentions 24 hours earlier;
- current rank;
- rank 24 hours earlier.

The attention score `0..1` combines mention volume and rank.

An increase in message count is not considered bullish: a crash can also cause
many discussions. Attention is used to increase or reduce the weight and
confidence of Gemma sentiment.

### 4. Signal Fusion

File: `analysis/src/ml/trend_ensemble.py`.

Base weights:

| Horizon | Historical | Sentiment |
|---|---:|---:|
| `1D` | 0.55 | 0.45 |
| `1W` | 0.65 | 0.35 |
| `1M` | 0.80 | 0.20 |

Social weight is reduced when ApeWisdom shows low attention.

The final score becomes:

```text
score = sum(source score * source weight) / sum(available weights)
```

Labels:

| Score | Label |
|---|---|
| `<= 0.43` | bearish |
| `0.43 .. 0.57` | neutral |
| `>= 0.57` | bullish |

Confidence combines:

- backtest quality;
- residual error;
- data quantity;
- post agreement;
- post count;
- ApeWisdom attention;
- agreement between history and sentiment;
- source availability.

Confidence is a prediction-quality indicator. It is not a probability of gain.

## Daily and Shared Training

Calculation is never launched by a user.

Normal cycle:

1. the scheduler checks whether daily history must be refreshed;
2. the new daily CSV files are downloaded;
3. the ML job iterates over the seven assets;
4. each asset independently trains its `1D`, `1W`, and `1M` models;
5. Reddit, Gemma, and ApeWisdom are called only once for that asset;
6. a temporary JSON snapshot is written;
7. the snapshot atomically replaces the old file;
8. clients all read the same result.

The candle carrying the current UTC date is excluded from training because
Yahoo can provide it before its close. The model only uses completed daily
candles. This avoids treating a partial intraday variation as the definitive
result of the day.

Persistent directory:

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

The directory belongs to the Docker volume `analysis_data`. Predictions
therefore survive container restarts.

An asset is recalculated if at least one condition is true:

- no snapshot exists;
- the snapshot was not trained today;
- a new daily date is available for this asset;
- the model version changed;
- Gemma has just been configured or removed;
- no sentiment attempt has been recorded today yet.

Server startup is the first opportunity to fill missing sentiments.
`socialAttemptedAt` is recorded even if Reddit returns no message or if Gemma
responds `429`. Only one attempt is therefore made per asset per day; the next
one waits for the daily job. A browser refresh or an additional restart on the
same day does not launch any call.

The process lock prevents two local ML jobs from running in parallel. Files are
replaced atomically: a client sees either the old complete result or the new one,
never a partially written JSON file.

## API

### Supported Assets

```http
GET /ml/assets
```

### Analysis

```http
GET /ml/analyse/NVDA
GET /ml/analyse/NVDA?horizon=1W
```

This endpoint only reads the persisted snapshot. It does not restart any
calculation.

### Cache State

```http
GET /ml/status
```

For each asset, this route indicates:

- snapshot availability;
- daily date used;
- training date;
- current or stale state.

The frontend uses an authenticated route:

```http
GET /api/ml/analyse?symbol=NVDA&horizon=1D
```

## Dashboard

The Trend and Sentiment tiles are no longer placeholders.

The Trend tile displays:

- bearish, neutral, or bullish label;
- score;
- horizon;
- estimated price;
- confidence.

The Sentiment tile displays:

- readable direction and Gemma score out of 100;
- message count;
- agreement between messages;
- ApeWisdom mentions and 24-hour variation.

Both tiles are grouped in an `AI Analysis` frame. This frame is absent for
assets outside the ML scope. In the watchlist, an `AI` badge identifies the
seven assets with a backend-computed analysis. These seven assets are present
in every user's default watchlist and remain grouped at the top regardless of
the selected sort.

Values are explainable on hover:

- the score reminds users that `0` means more sell, `50` hold, and `100` more
  buy, without representing a probability;
- agreement only indicates whether messages point in the same direction;
- mentions measure activity around the topic, not a direction.

Assets outside the scope display `Not available`.

## Cache and Cost

- one scheduled calculation per asset per day;
- no external call during a user request;
- Reddit/Gemma sentiment kept in memory for 30 minutes during the same job;
- ApeWisdom attention kept in memory for 15 minutes during the same job;
- maximum 100 candidates fetched per search;
- maximum 50 relevant posts sent to Gemma;
- maximum 180 title characters;
- maximum 360 excerpt characters.

The three horizons reuse the same recent sentiment. All users then reuse the
daily snapshot instead of calling Gemma.

## Tests

Python tests:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T analysis python -m unittest discover -s tests -v
```

They verify:

- regression and chronological validation;
- RSS parsing and filtering;
- rejection of a fake Google result;
- attention normalization;
- influence of attention on social weight;
- snapshot isolation by asset;
- absence of a second training for a current snapshot;
- daily refresh then ML job ordering.

Shared snapshot API test:

```bash
curl "http://localhost:8000/ml/analyse/NVDA"
```

Integration script:

```bash
node tests/scripts/test-ml-analysis.mjs
```

Frontend checks:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run lint

docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npx tsc --noEmit
```

## Validation Scenario

1. Configure `Gemma_API_KEY`.
2. Recreate the `analysis` service.
3. Select NVDA on the dashboard.
4. Show the `1D` result.
5. Switch the chart to `1W`, then `1M`.
6. Show score, estimated price, interval, and confidence.
7. Show message count and agreement.
8. Refresh the page several times and show that `trainedAt` does not change.
9. Show `/ml/status` and the seven distinct snapshots.
10. Explain low confidence with backtest metrics.

## Accepted Limitations

- Markets remain very difficult to predict.
- The estimated price is not financial advice.
- Reddit is not representative of all investors.
- ApeWisdom measures attention, not direction.
- The RSS feed can change or become unavailable.
- Gemma can misclassify an ambiguous message.
- Weights are explicit and not learned, because there is no social history
  aligned with prices.

A fusion Random Forest would only be defensible after several weeks or months
of storing the three signals and their real outcomes. It is therefore not used
in this first version.
