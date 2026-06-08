"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import type { WatchlistAsset } from "@/lib/assets";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  chartRanges,
  type ChartCandle,
  type ChartRange,
} from "@/lib/analysis-data";
import {
  createChartCsvExport,
  createChartExportFileName,
  createChartJsonExport,
} from "@/lib/chart-analytics";
import { getCandlestickWidth } from "@/lib/chart-layout";
import { getNextMarketOpen } from "@/lib/market-calendar";
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

type ChartVisualization = "candles" | "price";

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

function formatDateControlValue(timestamp: number, includeTime: boolean) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  const dateValue = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;

  return includeTime
    ? `${dateValue}T${pad(date.getHours())}:${pad(date.getMinutes())}`
    : dateValue;
}

function parseDateControlValue(
  value: string,
  includeTime: boolean,
  endOfRange: boolean
) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(
    includeTime
      ? value
      : `${value}T${endOfRange ? "23:59:59.999" : "00:00:00"}`
  );

  return Number.isFinite(timestamp) ? timestamp : null;
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
  locale: string,
  visualization: ChartVisualization,
  useFullOneDayWindow: boolean
) {
  if (candles.length === 0) {
    return {
      areaPath: "",
      candlesticks: [],
      linePath: "",
      points: [],
      xTicks: [],
      yTicks: [],
    };
  }

  const closes = candles.map((candle) => candle.close);
  const isCandlestickChart = visualization === "candles";
  const minPrice = Math.min(
    ...(isCandlestickChart
      ? candles.map((candle) => candle.low)
      : closes)
  );
  const maxPrice = Math.max(
    ...(isCandlestickChart
      ? candles.map((candle) => candle.high)
      : closes)
  );
  const valuePadding = Math.max(
    (maxPrice - minPrice) * 0.1,
    maxPrice * 0.002,
    1
  );
  const minValue = minPrice - valuePadding;
  const maxValue = maxPrice + valuePadding;
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
    useFullOneDayWindow &&
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
  const candleWidth = getCandlestickWidth(
    chartPoints.map((point) => point.x),
    usableWidth,
    range
  );

  return {
    areaPath: isCandlestickChart ? "" : areaPath,
    candlesticks: isCandlestickChart
      ? chartPoints.map((point) => {
          const openY = getY(point.candle.open);
          const closeY = getY(point.candle.close);
          const rawBodyHeight = Math.abs(closeY - openY);
          const bodyHeight = Math.max(rawBodyHeight, 2);
          const bodyY =
            rawBodyHeight >= 2
              ? Math.min(openY, closeY)
              : (openY + closeY) / 2 - bodyHeight / 2;

          return {
            bodyHeight,
            bodyY,
            highY: getY(point.candle.high),
            lowY: getY(point.candle.low),
            rising: point.candle.close >= point.candle.open,
            width: candleWidth,
            x: point.x,
          };
        })
      : [],
    linePath: isCandlestickChart ? "" : linePath,
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
            label: formatTooltipDate(
              candles[index],
              candles[index].timestamp,
              range,
              locale
            ),
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
  const [visualization, setVisualization] =
    useState<ChartVisualization>("price");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
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
    function updateCurrentTime() {
      setCurrentTime(Date.now());
    }

    const initialTimeout = window.setTimeout(updateCurrentTime, 0);
    const intervalId = window.setInterval(updateCurrentTime, 60_000);

    return () => {
      window.clearTimeout(initialTimeout);
      window.clearInterval(intervalId);
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

  const dateControlIncludesTime = range === "1D" || range === "1W";
  const minimumDateValue =
    candles.length > 0
      ? dateControlIncludesTime
        ? formatDateControlValue(candles[0].timestamp, true)
        : getDatePart(candles[0].datetime)
      : "";
  const maximumDateValue =
    candles.length > 0
      ? dateControlIncludesTime
        ? formatDateControlValue(
            candles.at(-1)?.timestamp ?? candles[0].timestamp,
            true
          )
        : getDatePart(candles.at(-1)?.datetime ?? candles[0].datetime)
      : "";
  const visibleCandles = useMemo(() => {
    if (!dateControlIncludesTime) {
      return candles.filter((candle) => {
        const candleDate = getDatePart(candle.datetime);

        return (
          (!dateFrom || candleDate >= dateFrom) &&
          (!dateTo || candleDate <= dateTo)
        );
      });
    }

    const fromTimestamp = parseDateControlValue(dateFrom, true, false);
    const toTimestamp = parseDateControlValue(dateTo, true, true);

    return candles.filter(
      (candle) =>
        (fromTimestamp === null || candle.timestamp >= fromTimestamp) &&
        (toTimestamp === null || candle.timestamp <= toTimestamp)
    );
  }, [candles, dateControlIncludesTime, dateFrom, dateTo]);
  const chartSize = isCompactChart ? compactChartSize : desktopChartSize;
  const chartData = useMemo(
    () =>
      buildChartData(
        visibleCandles,
        range,
        chartSize,
        locale,
        visualization,
        !dateFrom && !dateTo
      ),
    [
      chartSize,
      dateFrom,
      dateTo,
      locale,
      range,
      visibleCandles,
      visualization,
    ]
  );
  const firstCandle = visibleCandles[0] ?? null;
  const lastCandle = visibleCandles.at(-1) ?? null;
  const intradayDayChangePercent =
    range === "1D" ? dayChangePercent : null;
  const rangeChangePercent =
    intradayDayChangePercent ??
    (firstCandle && lastCandle
      ? ((lastCandle.close - firstCandle.close) / firstCandle.close) * 100
      : null);
  const tooltipStyle: CSSProperties | undefined = hoveredPoint
    ? {
        left: `${(hoveredPoint.x / chartSize.width) * 100}%`,
        top: `${Math.max(
          12,
          Math.min(88, (hoveredPoint.y / chartSize.height) * 100)
        )}%`,
      }
    : undefined;
  const tooltipAlignsLeft =
    hoveredPoint !== null && hoveredPoint.x > chartSize.width * 0.58;
  const nextMarketOpen =
    currentTime === null ? null : getNextMarketOpen(new Date(currentTime));

  function downloadChartData(format: "csv" | "json") {
    if (!asset || visibleCandles.length === 0) {
      return;
    }

    const context = {
      candles: visibleCandles,
      interval,
      range,
      source,
      symbol: asset.symbol,
      updatedAt,
    };
    const content =
      format === "csv"
        ? createChartCsvExport(context)
        : createChartJsonExport(context);
    const blob = new Blob([content], {
      type:
        format === "csv"
          ? "text/csv;charset=utf-8"
          : "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = createChartExportFileName(asset.symbol, range, format);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

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

      <div className="asset-chart-range-row">
        <div className="asset-chart-ranges" aria-label={t("rangeLabel")}>
          {chartRanges.map((option) => (
            <Button
              aria-pressed={range === option}
              className="asset-chart-range"
              key={option}
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                onRangeChange(option);
              }}
              variant="plain"
            >
              {option}
            </Button>
          ))}
        </div>

        <IconButton
          aria-controls="asset-chart-controls"
          aria-expanded={isMobileControlsOpen}
          className="asset-chart-controls-toggle"
          label={
            isMobileControlsOpen
              ? t("hideAdvancedControls")
              : t("showAdvancedControls")
          }
          onClick={() =>
            setIsMobileControlsOpen((currentValue) => !currentValue)
          }
          size="sm"
        >
          <span
            aria-hidden="true"
            className="asset-chart-controls-chevron"
          />
        </IconButton>
      </div>

      <div
        className={`asset-chart-controls-panel${
          isMobileControlsOpen ? " asset-chart-controls-panel-open" : ""
        }`}
        id="asset-chart-controls"
      >
        <div className="asset-chart-date-filters">
          <label>
            <span>{t("dateFrom")}</span>
            <input
              max={dateTo || maximumDateValue}
              min={minimumDateValue}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setHoveredPoint(null);
              }}
              type={dateControlIncludesTime ? "datetime-local" : "date"}
              value={dateFrom || minimumDateValue}
            />
          </label>
          <label>
            <span>{t("dateTo")}</span>
            <input
              max={maximumDateValue}
              min={dateFrom || minimumDateValue}
              onChange={(event) => {
                setDateTo(event.target.value);
                setHoveredPoint(null);
              }}
              type={dateControlIncludesTime ? "datetime-local" : "date"}
              value={dateTo || maximumDateValue}
            />
          </label>
          {dateFrom || dateTo ? (
            <Button
              className="asset-chart-date-reset"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setHoveredPoint(null);
              }}
              variant="plain"
            >
              {t("resetDates")}
            </Button>
          ) : null}
        </div>

        <div className="asset-chart-toolbar">
          <div aria-label={t("visualizationLabel")}>
            <SegmentedControl
              onChange={(nextVisualization) => {
                setVisualization(nextVisualization);
                setHoveredPoint(null);
              }}
              options={[
                {
                  label: t("visualizations.price"),
                  value: "price",
                },
                {
                  label: t("visualizations.candles"),
                  value: "candles",
                },
              ]}
              value={visualization}
            />
          </div>

          <div
            aria-label={t("exportLabel")}
            className="asset-chart-export-actions"
          >
            <Button
              disabled={
                isLoading || Boolean(error) || visibleCandles.length === 0
              }
              onClick={() => downloadChartData("csv")}
              variant="outline"
            >
              {t("exportCsv")}
            </Button>
            <Button
              disabled={
                isLoading || Boolean(error) || visibleCandles.length === 0
              }
              onClick={() => downloadChartData("json")}
              variant="outline"
            >
              {t("exportJson")}
            </Button>
          </div>
        </div>
      </div>

      <div className="asset-chart-body">
        {isLoading && <div className="chart-state">{t("loading")}</div>}

        {!isLoading && error && <div className="chart-state">{error}</div>}

        {!isLoading &&
          !error &&
          candles.length > 0 &&
          visibleCandles.length === 0 && (
            <div className="chart-state">{t("noFilteredData")}</div>
          )}

        {!isLoading &&
          !error &&
          visibleCandles.length > 0 && (
          <svg
            aria-label={t(
              visualization === "price" ? "priceChart" : "candlestickChart",
              {
              symbol: asset?.symbol ?? t("titleFallback"),
              }
            )}
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
            {visualization === "price" ? (
              <>
                <path className="asset-chart-area" d={chartData.areaPath} />
                <path className="asset-chart-line" d={chartData.linePath} />
              </>
            ) : (
              chartData.candlesticks.map((candle, index) => (
                <g
                  className={
                    candle.rising
                      ? "asset-chart-candle asset-chart-candle-rising"
                      : "asset-chart-candle asset-chart-candle-falling"
                  }
                  key={`${chartData.points[index].candle.timestamp}-${index}`}
                >
                  <line
                    className="asset-chart-candle-wick"
                    x1={candle.x}
                    x2={candle.x}
                    y1={candle.highY}
                    y2={candle.lowY}
                  />
                  <rect
                    className="asset-chart-candle-body"
                    height={candle.bodyHeight}
                    rx="1"
                    width={candle.width}
                    x={candle.x - candle.width / 2}
                    y={candle.bodyY}
                  />
                </g>
              ))
            )}
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
              </g>
            )}
          </svg>
        )}
        {!isCompactChart && hoveredPoint && tooltipStyle ? (
          <div
            className={`asset-chart-html-tooltip${
              tooltipAlignsLeft ? " asset-chart-html-tooltip-left" : ""
            }${
              visualization === "price"
                ? " asset-chart-html-tooltip-price"
                : ""
            }`}
            style={tooltipStyle}
          >
            {visualization === "candles" ? (
              <div className="asset-chart-tooltip-values">
                {[
                  ["open", hoveredPoint.candle.open],
                  ["high", hoveredPoint.candle.high],
                  ["low", hoveredPoint.candle.low],
                  ["close", hoveredPoint.candle.close],
                ].map(([label, value]) => (
                  <div className="asset-chart-tooltip-row" key={String(label)}>
                    <span>{t(String(label))}</span>
                    <strong>
                      {formatPrice(
                        Number(value),
                        currency,
                        locale,
                        commonT("na")
                      )}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <strong className="asset-chart-tooltip-price">
                {formatPrice(
                  hoveredPoint.candle.close,
                  currency,
                  locale,
                  commonT("na")
                )}
              </strong>
            )}
            <span className="asset-chart-tooltip-date">
              {hoveredPoint.tooltipDateLabel}
            </span>
          </div>
        ) : null}
      </div>

      <footer className="asset-chart-footer">
        <ChartFooterMetric
          label={t("points", { count: visibleCandles.length })}
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
          label={t("latestPoint", {
            value: lastCandle
              ? formatTooltipDate(
                  lastCandle,
                  lastCandle.timestamp,
                  range,
                  locale
                )
              : commonT("na"),
          })}
          tooltip={t("tooltips.latestPoint")}
        />
        <ChartFooterMetric
          label={t("updated", {
            value: formatRelativeUpdate(updatedAt, locale, commonT("na")),
          })}
          tooltip={t("tooltips.updated")}
        />
        <ChartFooterMetric
          label={t("nextMarketOpen", {
            value: nextMarketOpen
              ? new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(nextMarketOpen)
              : commonT("na"),
          })}
          tooltip={t("tooltips.nextMarketOpen")}
        />
      </footer>
    </section>
  );
}
