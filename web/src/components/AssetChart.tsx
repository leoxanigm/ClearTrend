"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import type { WatchlistAsset } from "@/lib/assets";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  chartRanges,
  type ChartCandle,
  type ChartRange,
} from "@/lib/analysis-data";
import { useLocale, useTranslations } from "next-intl";

type AssetChartProps = {
  asset: WatchlistAsset | null;
  financeRefreshRateSeconds: number;
  onAssetSnapshotChange?: (snapshot: AssetSnapshotUpdate) => void;
  onRangeChange: (range: ChartRange) => void;
  range: ChartRange;
};

type ChartResponse = {
  candles?: ChartCandle[];
  currency?: string | null;
  dayChangePercent?: number | null;
  interval?: string;
  lastPrice?: number | null;
  source?: string | null;
  symbol?: string;
  updatedAt?: string | null;
};

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

type ChartFooterMetricProps = {
  label: string;
  tooltip: string;
};

type AssetSnapshotUpdate = {
  dayChangePercent: number | null;
  lastPrice: number | null;
  symbol: string;
};

type ChartPoint = {
  candle: ChartCandle;
  tooltipDateLabel: string;
  x: number;
  y: number;
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

const chartMetaPollIntervalMs = 5 * 60 * 1000;
const chartMetaPollOffsetMs = 30 * 1000;
const chartRetryPollMs = 30 * 1000;
const regularStockSessionMs = 6.5 * 60 * 60 * 1000;

function ChartFooterMetric({ label, tooltip }: ChartFooterMetricProps) {
  return (
    <Tooltip
      content={tooltip}
      label={label}
    >
      {label}
    </Tooltip>
  );
}

async function fetchChartCandles(
  symbol: string,
  range: ChartRange,
  signal?: AbortSignal
) {
  const response = await fetch(
    `/api/assets/candles?symbol=${encodeURIComponent(symbol)}&range=${range}`,
    {
      cache: "no-store",
      signal,
    }
  );

  if (!response.ok) {
    throw new Error("Chart request failed");
  }

  return (await response.json()) as ChartResponse;
}

function getNextChartPollDelayMs(
  intervalMs = chartMetaPollIntervalMs,
  now = Date.now()
) {
  const currentSlot =
    Math.floor(now / intervalMs) * intervalMs;
  const nextSlotWithOffset = currentSlot + chartMetaPollOffsetMs;
  const nextPoll =
    nextSlotWithOffset > now
      ? nextSlotWithOffset
      : nextSlotWithOffset + intervalMs;

  return Math.max(nextPoll - now, 1000);
}

function formatPrice(
  value: number | null,
  currency: string | null | undefined,
  locale: string,
  fallback: string
) {
  if (value === null) {
    return fallback;
  }

  return new Intl.NumberFormat(locale, {
    currency: currency ?? "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number | null, fallback: string) {
  if (value === null) {
    return fallback;
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatVolume(value: number | null, locale: string, fallback: string) {
  if (value === null) {
    return fallback;
  }

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

function formatRelativeUpdate(
  value: string | null,
  locale: string,
  fallback: string
) {
  if (!value) {
    return fallback;
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return fallback;
  }

  const diffSeconds = Math.round((timestamp - Date.now()) / 1000);
  const divisions: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];
  const formatter = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
  });

  for (const [unit, seconds] of divisions) {
    if (Math.abs(diffSeconds) >= seconds || unit === "second") {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }

  return fallback;
}

function formatAxisPrice(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 100 ? 0 : 2,
    notation: value >= 1000 ? "compact" : "standard",
  }).format(value);
}

function getSystemTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function formatAxisTime(timestamp: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: getSystemTimeZone(),
  }).format(new Date(timestamp));
}

function getDatePart(datetime: string) {
  return datetime.includes("T")
    ? datetime.split("T")[0]
    : datetime.split(" ")[0];
}

function formatCalendarDate(
  datetime: string,
  range: ChartRange,
  locale: string
) {
  const datePart = getDatePart(datetime);
  const date = new Date(`${datePart}T00:00:00`);

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: range === "1Y" ? "short" : "2-digit",
  }).format(date);
}

function formatTimestampDate(
  timestamp: number,
  range: ChartRange,
  locale: string
) {
  const options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    timeZone: getSystemTimeZone(),
    year: range === "1Y" ? "numeric" : undefined,
  };

  if (range === "1D" || range === "1W") {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }

  return new Intl.DateTimeFormat(locale, options).format(new Date(timestamp));
}

function formatTooltipDate(
  candle: ChartCandle,
  displayTimestamp: number,
  range: ChartRange,
  locale: string
) {
  if (range === "1D" || range === "1W") {
    return formatTimestampDate(displayTimestamp, range, locale);
  }

  return formatCalendarDate(candle.datetime, range, locale);
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
  chartSize: ChartSize,
  locale: string
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
  const valuePadding = Math.max(
    (maxClose - minClose) * 0.1,
    maxClose * 0.002,
    1
  );
  const minValue = minClose - valuePadding;
  const maxValue = maxClose + valuePadding;
  const { height, padding, width } = chartSize;
  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;
  const lastIndex = Math.max(candles.length - 1, 1);
  const firstTimestamp = candles[0].timestamp;
  const lastTimestamp = candles[candles.length - 1].timestamp;
  // Keep the 1D chart on a fixed regular-session window. The coordinates use
  // absolute timestamps; labels are rendered in the browser/system timezone.
  const isFixedOneDayWindow =
    range === "1D" &&
    Number.isFinite(firstTimestamp) &&
    Number.isFinite(lastTimestamp);
  const oneDayWindowEnd = firstTimestamp + regularStockSessionMs;
  const xMin = isFixedOneDayWindow ? firstTimestamp : 0;
  const xMax = isFixedOneDayWindow
    ? Math.max(oneDayWindowEnd, lastTimestamp)
    : lastIndex;
  const xDomain = Math.max(xMax - xMin, 1);
  const xTickIndexes = Array.from(
    new Set([0, Math.floor(lastIndex / 2), lastIndex])
  );

  function getX(index: number) {
    if (isFixedOneDayWindow) {
      const timestamp = candles[index].timestamp;

      return padding.left + ((timestamp - xMin) / xDomain) * usableWidth;
    }

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
      tooltipDateLabel: formatTooltipDate(
        candle,
        candle.timestamp,
        range,
        locale
      ),
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
    xTicks: isFixedOneDayWindow
      ? [xMin, xMin + xDomain / 2, xMax].map((timestamp, tickIndex) => {
          const isFirstTick = tickIndex === 0;
          const isLastTick = tickIndex === 2;
          const anchor: "end" | "middle" | "start" = isFirstTick
            ? "start"
            : isLastTick
              ? "end"
              : "middle";

          return {
            anchor,
            label: formatAxisTime(timestamp, locale),
            x: padding.left + ((timestamp - xMin) / xDomain) * usableWidth,
          };
        })
      : xTickIndexes.map((index, tickIndex) => {
          const isFirstTick = tickIndex === 0;
          const isLastTick = tickIndex === xTickIndexes.length - 1;
          const anchor: "end" | "middle" | "start" = isFirstTick
            ? "start"
            : isLastTick
              ? "end"
              : "middle";

          return {
            anchor,
            label: formatCalendarDate(candles[index].datetime, range, locale),
            x: getX(index),
          };
        }),
    yTicks: yTickValues.map((value) => ({
      label: formatAxisPrice(value, locale),
      value,
      y: getY(value),
    })),
  };
}

export function AssetChart({
  asset,
  financeRefreshRateSeconds,
  onAssetSnapshotChange,
  onRangeChange,
  range,
}: AssetChartProps) {
  const locale = useLocale();
  const t = useTranslations("chart");
  const commonT = useTranslations("common");
  const [isCompactChart, setIsCompactChart] = useState(false);
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [dayChangePercent, setDayChangePercent] = useState<number | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [interval, setInterval] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updatedAtRef = useRef<string | null>(null);
  const chartPollIntervalMs = Math.max(financeRefreshRateSeconds * 1000, 60_000);

  const applyChartResponse = useCallback(
    (
      body: ChartResponse,
      requestedSymbol: string
    ) => {
      const nextCandles = body.candles ?? [];

      if (nextCandles.length === 0) {
        throw new Error("No chart data");
      }

      setCandles(nextCandles);
      setCurrency(body.currency ?? null);
      setDayChangePercent(body.dayChangePercent ?? null);
      setInterval(body.interval ?? null);
      setSource(body.source ?? null);
      updatedAtRef.current = body.updatedAt ?? null;
      setUpdatedAt(body.updatedAt ?? null);
      setHoveredPoint(null);
      setError(null);
      onAssetSnapshotChange?.({
        dayChangePercent: body.dayChangePercent ?? null,
        lastPrice: body.lastPrice ?? nextCandles.at(-1)?.close ?? null,
        symbol: body.symbol ?? requestedSymbol,
      });
    },
    [onAssetSnapshotChange]
  );

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
      setDayChangePercent(null);
      setHoveredPoint(null);

      try {
        const body = await fetchChartCandles(
          requestedSymbol,
          range,
          controller.signal
        );

        applyChartResponse(body, requestedSymbol);
      } catch {
        if (!controller.signal.aborted) {
          setCandles([]);
          setDayChangePercent(null);
          updatedAtRef.current = null;
          setUpdatedAt(null);
          setError(t("unavailable"));
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
  }, [applyChartResponse, asset?.symbol, range, t]);

  useEffect(() => {
    const symbol = asset?.symbol;

    if (!symbol) {
      return;
    }

    const requestedSymbol = symbol;
    let activeController: AbortController | null = null;
    let isDisposed = false;
    let timeoutId: number | null = null;

    async function refreshCandlesIfNeeded() {
      if (document.hidden) {
        return true;
      }

      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;

      try {
        const body = await fetchChartCandles(
          requestedSymbol,
          range,
          controller.signal
        );
        if (isDisposed) {
          return true;
        }

        const previousUpdatedAt = updatedAtRef.current;
        applyChartResponse(body, requestedSymbol);

        return Boolean(body.updatedAt && body.updatedAt !== previousUpdatedAt);
      } catch {
        // Background polling should never replace visible chart data with an
        // error state. The next interval can try again.
        return false;
      }
    }

    function scheduleNextRefresh(
      delayMs = getNextChartPollDelayMs(chartPollIntervalMs)
    ) {
      if (isDisposed) {
        return;
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        void refreshCandlesIfNeeded().then((changed) => {
          scheduleNextRefresh(
            changed ? getNextChartPollDelayMs(chartPollIntervalMs) : chartRetryPollMs
          );
        });
      }, delayMs);
    }

    scheduleNextRefresh();

    function handleVisibilityChange() {
      if (!document.hidden) {
        void refreshCandlesIfNeeded();
        scheduleNextRefresh();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isDisposed = true;
      activeController?.abort();
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [applyChartResponse, asset?.symbol, chartPollIntervalMs, range]);

  const chartSize = isCompactChart ? compactChartSize : desktopChartSize;
  const chartData = useMemo(
    () => buildChartData(candles, range, chartSize, locale),
    [candles, chartSize, locale, range]
  );
  const firstCandle = candles[0] ?? null;
  const lastCandle = candles[candles.length - 1] ?? null;
  const intradayDayChangePercent =
    range === "1D" ? dayChangePercent : null;
  const rangeChangePercent =
    intradayDayChangePercent ??
    (firstCandle && lastCandle
      ? ((lastCandle.close - firstCandle.close) / firstCandle.close) * 100
      : null);
  const tooltipWidth = 124;
  const tooltipHeight = 48;
  const tooltipGap = 12;
  const tooltipX =
    hoveredPoint &&
    hoveredPoint.x + tooltipWidth + tooltipGap >
      chartSize.width - chartSize.padding.right
      ? Math.max(
          chartSize.padding.left,
          hoveredPoint.x - tooltipWidth - tooltipGap
        )
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
          <p className="app-eyebrow">{asset?.symbol ?? t("titleFallback")}</p>
          <h2>{asset?.name ?? t("noAsset")}</h2>
        </div>

        <div className="asset-chart-price">
          <span>
            {formatPrice(
              lastCandle?.close ?? asset?.lastPrice ?? null,
              currency,
              locale,
              commonT("na")
            )}
          </span>
          <span className={getPerformanceClass(rangeChangePercent)}>
            {formatPercent(rangeChangePercent, commonT("na"))}
          </span>
        </div>
      </header>

      <div className="asset-chart-ranges" aria-label={t("rangeLabel")}>
        {chartRanges.map((option) => (
          <Button
            aria-pressed={range === option}
            className="asset-chart-range"
            key={option}
            onClick={() => onRangeChange(option)}
            variant="plain"
          >
            {option}
          </Button>
        ))}
      </div>

      <div className="asset-chart-body">
        {isLoading && <div className="chart-state">{t("loading")}</div>}

        {!isLoading && error && <div className="chart-state">{error}</div>}

        {!isLoading && !error && candles.length > 0 && (
          <svg
            aria-label={t("priceChart", {
              symbol: asset?.symbol ?? t("titleFallback"),
            })}
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
                key={`${tick.value}-${tick.y}`}
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
                    {formatPrice(
                      hoveredPoint.candle.close,
                      currency,
                      locale,
                      commonT("na")
                    )}
                  </text>
                  <text className="asset-chart-tooltip-date" x="10" y="36">
                    {hoveredPoint.tooltipDateLabel}
                  </text>
                </g>
              </g>
            )}
          </svg>
        )}
      </div>

      <footer className="asset-chart-footer">
        <ChartFooterMetric
          label={t("points", { count: candles.length })}
          tooltip={t("tooltips.points")}
        />
        <ChartFooterMetric
          label={interval ?? range}
          tooltip={t("tooltips.interval")}
        />
        <ChartFooterMetric
          label={source ?? t("providerFallback")}
          tooltip={t("tooltips.provider")}
        />
        <ChartFooterMetric
          label={t("volume", {
            value: formatVolume(lastCandle?.volume ?? null, locale, commonT("na")),
          })}
          tooltip={t("tooltips.volume")}
        />
        <ChartFooterMetric
          label={t("updated", {
            value: formatRelativeUpdate(updatedAt, locale, commonT("na")),
          })}
          tooltip={t("tooltips.updated")}
        />
      </footer>
    </section>
  );
}
