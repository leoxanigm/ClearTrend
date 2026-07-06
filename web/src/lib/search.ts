import { SearchDirection, SearchSortKey } from './search-types';

export function readEnum<T extends readonly string[]>(
  value: string | null,
  allowed: T,
  fallback: T[number]
): T[number] {
  return value && allowed.includes(value) ? value : fallback;
}

export function readPositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

// We would like to start from midnight of the date specified for a start date
export function readDateStart(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000`);

  return Number.isNaN(date.getTime()) ? null : date;
}

// 'Date to' will take till the end of the specified day
export function readDateEnd(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T23:59:59.999`);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeQuery(value: string | null) {
  return (value ?? '').trim().slice(0, 80);
}

export function normalizeOptional(value: string | null) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

export function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function getDateFilter(dateFrom: Date | null, dateTo: Date | null) {
  if (!dateFrom && !dateTo) {
    return undefined;
  }

  return {
    ...(dateFrom ? { gte: dateFrom } : {}),
    ...(dateTo ? { lte: dateTo } : {})
  };
}

export function getStringSearch(q: string, fields: string[]) {
  if (!q) {
    return undefined;
  }

  return fields.map(field => ({
    [field]: {
      contains: q,
      mode: 'insensitive' as const
    }
  }));
}

export function getAnalysisTrendLabel(sentiment: string | null) {
  if (!sentiment) {
    return undefined;
  }

  const normalized = sentiment.trim().toUpperCase();

  if (
    normalized === 'BULLISH' ||
    normalized === 'NEUTRAL' ||
    normalized === 'BEARISH'
  ) {
    return normalized;
  }

  return undefined;
}

export function getAssetOrderBy(sort: SearchSortKey, direction: SearchDirection) {
  if (sort === 'symbol') {
    return { symbol: direction };
  }

  if (sort === 'name') {
    return { name: direction };
  }

  return { createdAt: direction };
}

export function getAnalysisOrderBy(sort: SearchSortKey, direction: SearchDirection) {
  if (sort === 'symbol') {
    return {
      asset: { symbol: direction }
    };
  }

  if (sort === 'name') {
    return {
      asset: { name: direction }
    };
  }

  return { createdAt: direction };
}
