"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WatchlistAsset } from "@/lib/assets";

type SortMode = "dp-asc" | "dp-desc" | "name-asc" | "name-desc";

type WatchlistNavProps = {
  assets: WatchlistAsset[];
  mobile?: boolean;
};

type AssetSearchResult = {
  description: string | null;
  displaySymbol: string | null;
  symbol: string | null;
  type: string | null;
};

const sortOptions: Array<{ label: string; value: SortMode }> = [
  {
    label: "A-Z",
    value: "name-asc",
  },
  {
    label: "Z-A",
    value: "name-desc",
  },
  {
    label: "Best day",
    value: "dp-desc",
  },
  {
    label: "Worst day",
    value: "dp-asc",
  },
];

function formatDayChangePercent(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getDayChangeClass(value: number | null) {
  if (value === null || value === 0) {
    return "asset-performance-muted";
  }

  return value > 0
    ? "asset-performance-positive"
    : "asset-performance-negative";
}

function compareAssetNames(a: WatchlistAsset, b: WatchlistAsset) {
  return a.name.localeCompare(b.name, "en", {
    sensitivity: "base",
  });
}

function compareAssetPerformance(
  a: WatchlistAsset,
  b: WatchlistAsset,
  direction: "asc" | "desc"
) {
  if (a.dayChangePercent === null && b.dayChangePercent === null) {
    return compareAssetNames(a, b);
  }

  if (a.dayChangePercent === null) {
    return 1;
  }

  if (b.dayChangePercent === null) {
    return -1;
  }

  const result = a.dayChangePercent - b.dayChangePercent;

  return direction === "asc" ? result : -result;
}

function sortAssets(assets: WatchlistAsset[], sortMode: SortMode) {
  return [...assets].sort((a, b) => {
    if (sortMode === "name-asc") {
      return compareAssetNames(a, b);
    }

    if (sortMode === "name-desc") {
      return compareAssetNames(b, a);
    }

  if (sortMode === "dp-desc") {
      return compareAssetPerformance(a, b, "desc");
    }

    return compareAssetPerformance(a, b, "asc");
  });
}

function WatchlistItem({
  asset,
  mobile,
  onSelect,
  selected,
  setItemRef,
}: {
  asset: WatchlistAsset;
  mobile: boolean;
  onSelect: (symbol: string) => void;
  selected: boolean;
  setItemRef: (symbol: string, element: HTMLElement | null) => void;
}) {
  const className = `sidebar-item sidebar-asset${
    selected ? " sidebar-asset-selected" : ""
  }`;
  const content = (
    <>
      <span className="sidebar-asset-main">
        <span className="sidebar-asset-name">{asset.name}</span>
        <span className="sidebar-asset-symbol">{asset.symbol}</span>
      </span>
      <span
        className={`sidebar-performance ${getDayChangeClass(
          asset.dayChangePercent
        )}`}
      >
        {formatDayChangePercent(asset.dayChangePercent)}
      </span>
    </>
  );

  if (mobile) {
    return (
      <label
        className={className}
        htmlFor="dashboard-drawer"
        onClick={() => onSelect(asset.symbol)}
        ref={(element) => setItemRef(asset.symbol, element)}
      >
        {content}
      </label>
    );
  }

  return (
    <button
      aria-label={`${asset.name} ${formatDayChangePercent(
        asset.dayChangePercent
      )}`}
      aria-pressed={selected}
      className={className}
      onClick={() => onSelect(asset.symbol)}
      ref={(element) => setItemRef(asset.symbol, element)}
      type="button"
    >
      {content}
    </button>
  );
}

export function WatchlistNav({ assets, mobile = false }: WatchlistNavProps) {
  const [watchlistAssets, setWatchlistAssets] = useState(assets);
  const [selectedSymbol, setSelectedSymbol] = useState(
    assets[0]?.symbol ?? null
  );
  const [sortMode, setSortMode] = useState<SortMode>("name-asc");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchMessage(null);

      try {
        const response = await fetch(
          `/api/assets/search?q=${encodeURIComponent(trimmedQuery)}`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const body = (await response.json()) as {
          results?: AssetSearchResult[];
        };
        const nextResults = body.results ?? [];

        setResults(nextResults);
        setSearchMessage(nextResults.length === 0 ? "No result" : null);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearchMessage("Search failed");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  const sortedAssets = useMemo(
    () => sortAssets(watchlistAssets, sortMode),
    [watchlistAssets, sortMode]
  );
  const searchInputId = mobile ? "asset-search-mobile" : "asset-search-desktop";

  useEffect(() => {
    if (!selectedSymbol) {
      return;
    }

    itemRefs.current.get(selectedSymbol)?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [selectedSymbol, sortedAssets]);

  function setItemRef(symbol: string, element: HTMLElement | null) {
    if (element) {
      itemRefs.current.set(symbol, element);
      return;
    }

    itemRefs.current.delete(symbol);
  }

  function handleQueryChange(value: string) {
    setQuery(value);

    if (value.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      setSearchMessage(null);
    }
  }

  async function addAsset(symbol: string | null) {
    if (!symbol) {
      return;
    }

    const normalizedSymbol = symbol.trim().toUpperCase();

    if (
      watchlistAssets.some((asset) => asset.symbol === normalizedSymbol)
    ) {
      setSelectedSymbol(normalizedSymbol);
      setQuery("");
      setResults([]);
      return;
    }

    setSearchMessage("Adding...");

    try {
      const response = await fetch(
        `/api/assets/watchlist?symbols=${encodeURIComponent(normalizedSymbol)}`
      );

      if (!response.ok) {
        throw new Error("Add failed");
      }

      const body = (await response.json()) as {
        assets?: WatchlistAsset[];
      };
      const [asset] = body.assets ?? [];

      if (!asset) {
        throw new Error("No asset returned");
      }

      setWatchlistAssets((currentAssets) => [...currentAssets, asset]);
      setSelectedSymbol(asset.symbol);
      setQuery("");
      setResults([]);
      setSearchMessage(null);
    } catch {
      setSearchMessage("Could not add asset");
    }
  }

  return (
    <div className="watchlist-panel mt-5">
      <div className="asset-search">
        <label className="watchlist-sort-label" htmlFor={searchInputId}>
          Search asset
        </label>
        <input
          className="asset-search-input"
          id={searchInputId}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="Apple, TSLA..."
          type="search"
          value={query}
        />

        {(results.length > 0 || isSearching || searchMessage) && (
          <div className="asset-search-results">
            {isSearching && (
              <p className="asset-search-message">Searching...</p>
            )}

            {!isSearching &&
              results.map((result) => (
                <button
                  className="asset-search-result"
                  key={`${result.symbol}-${result.description}`}
                  onClick={() => addAsset(result.symbol)}
                  type="button"
                >
                  <span className="asset-search-result-name">
                    {result.description}
                  </span>
                  <span className="asset-search-result-symbol">
                    {result.displaySymbol ?? result.symbol}
                  </span>
                </button>
              ))}

            {!isSearching && searchMessage && (
              <p className="asset-search-message">{searchMessage}</p>
            )}
          </div>
        )}
      </div>

      <label className="watchlist-sort">
        <span className="watchlist-sort-label">Sort</span>
        <select
          className="watchlist-sort-select"
          onChange={(event) => setSortMode(event.target.value as SortMode)}
          value={sortMode}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <nav className="watchlist-nav space-y-2">
        {sortedAssets.map((asset) => (
          <WatchlistItem
            asset={asset}
            key={asset.symbol}
            mobile={mobile}
            onSelect={setSelectedSymbol}
            selected={asset.symbol === selectedSymbol}
            setItemRef={setItemRef}
          />
        ))}
      </nav>
    </div>
  );
}
