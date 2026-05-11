"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import type { WatchlistAsset } from "@/lib/assets";
import type { ChartCandle } from "@/lib/twelvedata";

type AssetChartProps = {
  asset: WatchlistAsset | null;
};

type ChartResponse = {
  candles?: ChartCandle[];
  currency?: string | null;
  exchange?: string | null;
  interval?: string;
  symbol?: string;
};

const chartRanges = ["1D", "1M", "3M", "1Y"] as const;
type ChartRange = (typeof chartRanges)[number];

type ChartSize = {
  height: number;
  padding: {
    bottom: number;
    left: number;
    right: number;
    top: number;
  };
  width: number;
};

const desktopChartSize: ChartSize = {
  height: 400,
  padding: {
    bottom: 32,
    left: 46,
    right: 34,
    top: 20,
  },
  width: 720,
};

const compactChartSize: ChartSize = {
  height: 230,
  padding: {
    bottom: 24,
    left: 34,
    right: 22,
    top: 10,
  },
  width: 360,
};

function formatPrice(value: number | null, currency?: string | null) {
  if (value === null) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    currency: currency ?? "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatVolume(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

function formatAxisPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 2,
    notation: value >= 1000 ? "compact" : "standard",
  }).format(value);
}

function formatAxisDate(datetime: string, range: ChartRange) {
  const [datePart, timePart] = datetime.split(" ");

  if (range === "1D" && timePart) {
    return timePart.slice(0, 5);
  }

  const date = new Date(`${datePart}T00:00:00`);

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: range === "1Y" ? "short" : "2-digit",
  }).format(date);
}

function formatTooltipDate(datetime: string, range: ChartRange) {
  const [datePart, timePart] = datetime.split(" ");
  const date = new Date(`${datePart}T${timePart ?? "00:00:00"}`);

  if (Number.isNaN(date.getTime())) {
    return datetime;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: timePart ? "2-digit" : undefined,
    minute: timePart ? "2-digit" : undefined,
    month: "short",
    year: range === "1Y" ? "numeric" : undefined,
  }).format(date);
}

function getPerformanceClass(value: number | null) {
  if (value === null || value === 0) {
    return "asset-performance-muted";
  }

  return value > 0
    ? "asset-performance-positive"
    : "asset-performance-negative";
}

function buildChartData(
  candles: ChartCandle[],
  range: ChartRange,
  chartSize: ChartSize
) {
  if (candles.length === 0) {
    return {
      areaPath: "",
      linePath: "",
      points: [],
      xTicks: [],
      yTicks: [],
    };
  }

  const closes = candles.map((candle) => candle.close);
  const minClose = Math.min(...closes);
  const maxClose = Math.max(...closes);
  const valuePadding = Math.max((maxClose - minClose) * 0.1, maxClose * 0.002, 1);
  const minValue = minClose - valuePadding;
  const maxValue = maxClose + valuePadding;
  const { height, padding, width } = chartSize;
  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;
  const lastIndex = Math.max(candles.length - 1, 1);
  const xTickIndexes = Array.from(
    new Set([0, Math.floor(lastIndex / 2), lastIndex])
  );

  function getX(index: number) {
    return padding.left + (index / lastIndex) * usableWidth;
  }

  function getY(value: number) {
    const ratio = (value - minValue) / (maxValue - minValue);

    return padding.top + (1 - ratio) * usableHeight;
  }

  const chartPoints = candles.map((candle, index) => {
    const x = getX(index);
    const y = getY(candle.close);

    return {
      candle,
      x,
      y,
    };
  });
  const points = chartPoints.map(
    (point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`
  );
  const linePath = `M ${points.join(" L ")}`;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const chartBottom = height - padding.bottom;
  const areaPath = `${linePath} L ${
    lastPoint.split(",")[0]
  },${chartBottom} L ${firstPoint.split(",")[0]},${chartBottom} Z`;
  const yTickValues = [maxValue, (maxValue + minValue) / 2, minValue];

  return {
    areaPath,
    linePath,
    points: chartPoints,
    xTicks: xTickIndexes.map((index, tickIndex) => {
      const isFirstTick = tickIndex === 0;
      const isLastTick = tickIndex === xTickIndexes.length - 1;
      const anchor: "end" | "middle" | "start" = isFirstTick
        ? "start"
        : isLastTick
          ? "end"
          : "middle";

      return {
        anchor,
        label: formatAxisDate(candles[index].datetime, range),
        x: getX(index),
      };
    }),
    yTicks: yTickValues.map((value) => ({
      label: formatAxisPrice(value),
      y: getY(value),
    })),
  };
}

export function AssetChart({ asset }: AssetChartProps) {
  const [isCompactChart, setIsCompactChart] = useState(false);
  const [range, setRange] = useState<ChartRange>("1M");
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<
    { candle: ChartCandle; x: number; y: number } | null
  >(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [exchange, setExchange] = useState<string | null>(null);
  const [interval, setInterval] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 600px)");

    function handleMediaChange() {
      setIsCompactChart(mediaQuery.matches);
    }

    handleMediaChange();
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, []);

  useEffect(() => {
    const symbol = asset?.symbol;

    if (!symbol) {
      return;
    }

    const requestedSymbol = symbol;
    const controller = new AbortController();

    async function loadCandles() {
      setIsLoading(true);
      setError(null);
      setHoveredPoint(null);

      try {
        const response = await fetch(
          `/api/assets/candles?symbol=${encodeURIComponent(
            requestedSymbol
          )}&range=${range}`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Chart request failed");
        }

        const body = (await response.json()) as ChartResponse;
        const nextCandles = body.candles ?? [];

        if (nextCandles.length === 0) {
          throw new Error("No chart data");
        }

        setCandles(nextCandles);
        setCurrency(body.currency ?? null);
        setExchange(body.exchange ?? null);
        setInterval(body.interval ?? null);
      } catch {
        if (!controller.signal.aborted) {
          setCandles([]);
          setError("Chart unavailable");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadCandles();

    return () => {
      controller.abort();
    };
  }, [asset?.symbol, range]);

  const chartSize = isCompactChart ? compactChartSize : desktopChartSize;
  const chartData = useMemo(
    () => buildChartData(candles, range, chartSize),
    [candles, chartSize, range]
  );
  const firstCandle = candles[0] ?? null;
  const lastCandle = candles[candles.length - 1] ?? null;
  const rangeChangePercent =
    firstCandle && lastCandle
      ? ((lastCandle.close - firstCandle.close) / firstCandle.close) * 100
      : null;
  const tooltipWidth = 124;
  const tooltipHeight = 48;
  const tooltipGap = 12;
  const tooltipX =
    hoveredPoint &&
    hoveredPoint.x + tooltipWidth + tooltipGap >
      chartSize.width - chartSize.padding.right
      ? Math.max(chartSize.padding.left, hoveredPoint.x - tooltipWidth - tooltipGap)
      : (hoveredPoint?.x ?? 0) + tooltipGap;
  const tooltipY = hoveredPoint
    ? Math.max(
        chartSize.padding.top + 6,
        Math.min(
          hoveredPoint.y - tooltipHeight / 2,
          chartSize.height - chartSize.padding.bottom - tooltipHeight - 6
        )
      )
    : 0;

  function handleChartMouseMove(event: MouseEvent<SVGSVGElement>) {
    if (isCompactChart || chartData.points.length === 0) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const cursorX =
      ((event.clientX - bounds.left) / bounds.width) * chartSize.width;
    const nearestPoint = chartData.points.reduce((nearest, point) =>
      Math.abs(point.x - cursorX) < Math.abs(nearest.x - cursorX)
        ? point
        : nearest
    );

    setHoveredPoint(nearestPoint);
  }

  return (
    <section className="asset-chart">
      <header className="asset-chart-header">
        <div className="asset-chart-title">
          <p className="app-eyebrow">{asset?.symbol ?? "Chart"}</p>
          <h2>{asset?.name ?? "No asset selected"}</h2>
        </div>

        <div className="asset-chart-price">
          <span>{formatPrice(lastCandle?.close ?? asset?.lastPrice ?? null, currency)}</span>
          <span className={getPerformanceClass(rangeChangePercent)}>
            {formatPercent(rangeChangePercent)}
          </span>
        </div>
      </header>

      <div className="asset-chart-ranges" aria-label="Chart range">
        {chartRanges.map((option) => (
          <button
            aria-pressed={range === option}
            className="asset-chart-range"
            key={option}
            onClick={() => setRange(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>

      <div className="asset-chart-body">
        {isLoading && <div className="chart-state">Loading chart...</div>}

        {!isLoading && error && <div className="chart-state">{error}</div>}

        {!isLoading && !error && candles.length > 0 && (
          <svg
            aria-label={`${asset?.symbol ?? "Asset"} price chart`}
            className="asset-chart-svg"
            onMouseLeave={() => setHoveredPoint(null)}
            onMouseMove={handleChartMouseMove}
            preserveAspectRatio="xMinYMid meet"
            viewBox={`0 0 ${chartSize.width} ${chartSize.height}`}
          >
            <line
              className="asset-chart-grid"
              x1={chartSize.padding.left}
              x2={chartSize.width - chartSize.padding.right}
              y1={chartSize.padding.top}
              y2={chartSize.padding.top}
            />
            <line
              className="asset-chart-grid"
              x1={chartSize.padding.left}
              x2={chartSize.width - chartSize.padding.right}
              y1={chartSize.height / 2}
              y2={chartSize.height / 2}
            />
            <line
              className="asset-chart-grid"
              x1={chartSize.padding.left}
              x2={chartSize.width - chartSize.padding.right}
              y1={chartSize.height - chartSize.padding.bottom}
              y2={chartSize.height - chartSize.padding.bottom}
            />
            <line
              className="asset-chart-axis"
              x1={chartSize.padding.left}
              x2={chartSize.padding.left}
              y1={chartSize.padding.top}
              y2={chartSize.height - chartSize.padding.bottom}
            />
            <line
              className="asset-chart-axis"
              x1={chartSize.padding.left}
              x2={chartSize.width - chartSize.padding.right}
              y1={chartSize.height - chartSize.padding.bottom}
              y2={chartSize.height - chartSize.padding.bottom}
            />
            {chartData.yTicks.map((tick) => (
              <text
                className="asset-chart-axis-label asset-chart-y-label"
                key={tick.label}
                x={chartSize.padding.left - 6}
                y={tick.y}
              >
                {tick.label}
              </text>
            ))}
            {chartData.xTicks.map((tick) => (
              <text
                className="asset-chart-axis-label asset-chart-x-label"
                key={`${tick.label}-${tick.x}`}
                textAnchor={tick.anchor}
                x={tick.x}
                y={chartSize.height - 15}
              >
                {tick.label}
              </text>
            ))}
            <path className="asset-chart-area" d={chartData.areaPath} />
            <path className="asset-chart-line" d={chartData.linePath} />
            {!isCompactChart && hoveredPoint && (
              <g className="asset-chart-hover">
                <line
                  className="asset-chart-hover-line"
                  x1={hoveredPoint.x}
                  x2={hoveredPoint.x}
                  y1={chartSize.padding.top}
                  y2={chartSize.height - chartSize.padding.bottom}
                />
                <line
                  className="asset-chart-hover-line"
                  x1={chartSize.padding.left}
                  x2={chartSize.width - chartSize.padding.right}
                  y1={hoveredPoint.y}
                  y2={hoveredPoint.y}
                />
                <circle
                  className="asset-chart-hover-point"
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r="4"
                />
                <g transform={`translate(${tooltipX}, ${tooltipY})`}>
                  <rect
                    className="asset-chart-tooltip-box"
                    height={tooltipHeight}
                    rx="5"
                    width={tooltipWidth}
                  />
                  <text className="asset-chart-tooltip-value" x="10" y="19">
                    {formatPrice(hoveredPoint.candle.close, currency)}
                  </text>
                  <text className="asset-chart-tooltip-date" x="10" y="36">
                    {formatTooltipDate(hoveredPoint.candle.datetime, range)}
                  </text>
                </g>
              </g>
            )}
          </svg>
        )}
      </div>

      <footer className="asset-chart-footer">
        <span>{candles.length} points</span>
        <span>{interval ?? range}</span>
        <span>{exchange ?? "Twelve Data"}</span>
        <span>Volume {formatVolume(lastCandle?.volume ?? null)}</span>
      </footer>
    </section>
  );
}
