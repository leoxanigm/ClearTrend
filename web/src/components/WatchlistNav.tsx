"use client";

import { useMemo, useState } from "react";
import type { WatchlistAsset } from "@/lib/assets";

type SortMode = "dp-asc" | "dp-desc" | "name-asc" | "name-desc";

type WatchlistNavProps = {
  assets: WatchlistAsset[];
  mobile?: boolean;
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
}: {
  asset: WatchlistAsset;
  mobile: boolean;
}) {
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
        className="sidebar-item sidebar-asset"
        htmlFor="dashboard-drawer"
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
      className="sidebar-item sidebar-asset"
      type="button"
    >
      {content}
    </button>
  );
}

export function WatchlistNav({ assets, mobile = false }: WatchlistNavProps) {
  const [sortMode, setSortMode] = useState<SortMode>("name-asc");
  const sortedAssets = useMemo(
    () => sortAssets(assets, sortMode),
    [assets, sortMode]
  );

  return (
    <div className="watchlist-panel mt-10">
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
          <WatchlistItem asset={asset} key={asset.symbol} mobile={mobile} />
        ))}
      </nav>
    </div>
  );
}
