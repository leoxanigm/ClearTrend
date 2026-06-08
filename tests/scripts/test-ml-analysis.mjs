const baseUrl = process.env.ANALYSIS_TEST_URL ?? "http://localhost:8000";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const assetsResponse = await fetch(`${baseUrl}/ml/assets`);
assert(assetsResponse.ok, `ML assets endpoint returned ${assetsResponse.status}`);
const assets = await assetsResponse.json();
assert(Array.isArray(assets.tickers), "ML asset list is missing");
assert(assets.tickers.includes("NVDA"), "NVDA is missing from ML assets");
assert(assets.tickers.includes("GC=F"), "Gold is missing from ML assets");

const analysisResponse = await fetch(
  `${baseUrl}/ml/analyse/NVDA`
);
assert(
  analysisResponse.ok,
  `ML analysis endpoint returned ${analysisResponse.status}`
);
const analysis = await analysisResponse.json();

assert(analysis.ticker === "NVDA", "Unexpected ticker in ML response");
assert(analysis.predictions.length === 3, "Expected three ML horizons");

for (const prediction of analysis.predictions) {
  assert(
    ["1D", "1W", "1M"].includes(prediction.horizon),
    `Unexpected horizon ${prediction.horizon}`
  );
  assert(
    prediction.score >= 0 && prediction.score <= 1,
    `Invalid trend score for ${prediction.horizon}`
  );
  assert(
    prediction.confidence >= 0 && prediction.confidence <= 1,
    `Invalid confidence for ${prediction.horizon}`
  );
  assert(
    prediction.estimatedPrice > 0,
    `Invalid estimated price for ${prediction.horizon}`
  );
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      ticker: analysis.ticker,
      predictions: analysis.predictions.map((prediction) => ({
        confidence: prediction.confidence,
        estimatedPrice: prediction.estimatedPrice,
        horizon: prediction.horizon,
        score: prediction.score,
        trend: prediction.trend,
      })),
    },
    null,
    2
  )
);
