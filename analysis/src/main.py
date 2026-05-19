import pandas as pd
from fastapi import FastAPI, HTTPException, Query

from .database_builder import DATA_DIR


app = FastAPI(title="Transcendence Analysis Service")

def _sanitize(ticker: str) -> str:
    return ticker.replace("/", "_").replace("^", "").upper()


def _load(ticker: str) -> pd.DataFrame:
    safe = _sanitize(ticker)
    path = next(DATA_DIR.glob(f"{safe}_*.csv"), None)
    if path is None:
        raise HTTPException(status_code=404, detail=f"No data for ticker '{ticker}'")
    df = pd.read_csv(path, index_col=0, parse_dates=True)
    df.index.name = "Date"
    return df


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Analysis service is running"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "analysis"}


@app.get("/tickers")
def tickers() -> dict[str, list[str]]:
    seen: set[str] = set()
    for path in DATA_DIR.glob("*.csv"):
        name = path.stem.rsplit("_", 1)[0]
        seen.add(name)
    return {"tickers": sorted(seen)}


@app.get("/history/{ticker}/latest")
def latest(ticker: str) -> dict:
    df = _load(ticker)
    last = df.iloc[-1]
    return {
        "ticker": _sanitize(ticker),
        "date": pd.Timestamp(df.index[-1]).strftime("%Y-%m-%d"),
        "data": {k: (None if pd.isna(v) else float(v)) for k, v in last.items()},
    }


@app.get("/candles/{ticker}")
def candles(ticker: str,
    		start: str | None = Query(None),
    		end: str | None = Query(None),
    		limit: int | None = Query(None, ge=1, le=10000)) -> dict:
    df = _load(ticker)
    if start:
        df = df[df.index >= pd.Timestamp(start)]
    if end:
        df = df[df.index <= pd.Timestamp(end)]
    if limit:
        df = df.tail(limit)
    out = [
        {
            "t": pd.Timestamp(idx).strftime("%Y-%m-%d"),
            "o": None if pd.isna(row["Open"]) else float(row["Open"]),
            "h": None if pd.isna(row["High"]) else float(row["High"]),
            "l": None if pd.isna(row["Low"]) else float(row["Low"]),
            "c": None if pd.isna(row["Close"]) else float(row["Close"]),
            "v": None if pd.isna(row["Volume"]) else float(row["Volume"]),
        }
        for idx, row in df.iterrows()
    ]
    return {"ticker": _sanitize(ticker), "candles": out}
