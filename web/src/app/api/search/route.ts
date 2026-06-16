import { getApiUserProfile } from '@/lib/api-auth';
import { getPrisma } from '@/lib/prisma';
import {
  searchDirections,
  searchEntityTypes,
  searchSortKeys,
  type SearchDirection,
  type SearchEntityType,
  type SearchResponse,
  type SearchResultItem,
  type SearchSortKey
} from '@/lib/search-types';
import { NextResponse } from 'next/server';
import { TrendLabel, SourceKind } from '@/generated/prisma/enums';

export const dynamic = 'force-dynamic';

const maxLimit = 50;
const defaultLimit = 10;

function readEnum<T extends readonly string[]>(
  value: string | null,
  allowed: T,
  fallback: T[number]
): T[number] {
  return value && allowed.includes(value) ? value : fallback;
}

function readPositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function readDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeQuery(value: string | null) {
  return (value ?? '').trim().slice(0, 80);
}

function normalizeOptional(value: string | null) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function getDateFilter(dateFrom: Date | null, dateTo: Date | null) {
  if (!dateFrom && !dateTo) {
    return undefined;
  }

  return {
    ...(dateFrom ? { gte: dateFrom } : {}),
    ...(dateTo ? { lte: dateTo } : {})
  };
}

function getStringSearch(q: string, fields: string[]) {
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

function getAnalysisTrendLabel(sentiment: string | null) {
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

function getSourceKind(source: string | null) {
  if (!source) {
    return undefined;
  }

  const normalized = source.trim().toUpperCase();

  if (
    normalized === 'PRICE' ||
    normalized === 'COMMENT' ||
    normalized === 'NEWS' ||
    normalized === 'API' ||
    normalized === 'SCRAPE'
  ) {
    return normalized;
  }

  return undefined;
}

function getAssetOrderBy(sort: SearchSortKey, direction: SearchDirection) {
  if (sort === 'symbol') {
    return { symbol: direction };
  }

  if (sort === 'name') {
    return { name: direction };
  }

  return { createdAt: direction };
}

function getAnalysisOrderBy(sort: SearchSortKey, direction: SearchDirection) {
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

function getCreatedAtOrderBy(direction: SearchDirection) {
  return {
    createdAt: direction
  };
}

async function searchAssets(input: {
  dateFrom: Date | null;
  dateTo: Date | null;
  direction: SearchDirection;
  limit: number;
  page: number;
  q: string;
  sort: SearchSortKey;
}) {
  const prisma = getPrisma();
  const skip = (input.page - 1) * input.limit;
  const createdAt = getDateFilter(input.dateFrom, input.dateTo);
  const stringSearch = getStringSearch(input.q, ['symbol', 'name']);

  const where = {
    ...(createdAt ? { createdAt } : {}),
    ...(stringSearch ? { OR: stringSearch } : {})
  };

  const [total, rows] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.findMany({
      orderBy: getAssetOrderBy(input.sort, input.direction),
      skip,
      take: input.limit,
      where
    })
  ]);

  const results: SearchResultItem[] = rows.map(asset => ({
    id: asset.id,
    type: 'asset',
    title: asset.name ?? asset.symbol,
    subtitle: asset.symbol,
    description: null,
    href: `/dashboard?symbol=${encodeURIComponent(asset.symbol)}`,
    createdAt: toIso(asset.createdAt),
    metadata: {
      lastPrice: asset.lastPrice,
      symbol: asset.symbol
    }
  }));

  return { results, total };
}

async function searchAnalyses(input: {
  dateFrom: Date | null;
  dateTo: Date | null;
  direction: SearchDirection;
  limit: number;
  page: number;
  q: string;
  sentiment: string | null;
  source: string | null;
  userId: string;
  sort: SearchSortKey;
}) {
  const prisma = getPrisma();
  const skip = (input.page - 1) * input.limit;
  const createdAt = getDateFilter(input.dateFrom, input.dateTo);
  const trendLabel = getAnalysisTrendLabel(input.sentiment) as TrendLabel;
  const sourceKind = getSourceKind(input.source) as SourceKind;

  const where = {
    ...(createdAt ? { createdAt } : {}),
    ...(trendLabel ? { trendLabel } : {}),
    ...(sourceKind
      ? {
          sources: {
            some: {
              kind: sourceKind
            }
          }
        }
      : {}),
    ...(input.q
      ? {
          OR: [
            {
              summary: {
                contains: input.q,
                mode: 'insensitive' as const
              }
            },
            {
              horizon: {
                contains: input.q,
                mode: 'insensitive' as const
              }
            },
            {
              asset: {
                is: {
                  OR: [
                    {
                      symbol: {
                        contains: input.q,
                        mode: 'insensitive' as const
                      }
                    },
                    {
                      name: {
                        contains: input.q,
                        mode: 'insensitive' as const
                      }
                    }
                  ]
                }
              }
            }
          ]
        }
      : {})
  };

  const [total, rows] = await Promise.all([
    prisma.analysis.count({ where }),
    prisma.analysis.findMany({
      include: {
        asset: true
      },
      orderBy: getAnalysisOrderBy(input.sort, input.direction),
      skip,
      take: input.limit,
      where
    })
  ]);

  const results: SearchResultItem[] = rows.map(analysis => ({
    id: analysis.id,
    type: 'analysis',
    title: `${analysis.asset.symbol} analysis`,
    subtitle: analysis.status,
    description: analysis.summary,
    href: null,
    createdAt: toIso(analysis.createdAt),
    metadata: {
      confidenceScore: analysis.confidenceScore,
      emotionScore: analysis.emotionScore,
      recommendation: analysis.recommendation,
      technicalScore: analysis.technicalScore,
      trendLabel: analysis.trendLabel
    }
  }));

  return { results, total };
}

function mergeSearchResults(
  groups: Array<{ results: SearchResultItem[]; total: number }>,
  limit: number,
  page: number,
  direction: SearchDirection
) {
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  const sorted = groups
    .flatMap(group => group.results)
    .sort((a, b) => {
      const left = a.createdAt ? Date.parse(a.createdAt) : 0;
      const right = b.createdAt ? Date.parse(b.createdAt) : 0;

      return direction === 'asc' ? left - right : right - left;
    });

  return {
    results: sorted.slice(0, limit),
    total,
    page
  };
}

export async function GET(req: Request) {
  const { profile, response } = await getApiUserProfile(req);

  if (response) {
    return response;
  }

  const url = new URL(req.url);
  const q = normalizeQuery(url.searchParams.get('q'));
  const type = readEnum(
    url.searchParams.get('type'),
    searchEntityTypes,
    'all'
  ) as SearchEntityType;
  const sort = readEnum(
    url.searchParams.get('sort'),
    searchSortKeys,
    'createdAt'
  ) as SearchSortKey;
  const direction = readEnum(
    url.searchParams.get('direction'),
    searchDirections,
    'desc'
  ) as SearchDirection;
  const page = readPositiveInteger(url.searchParams.get('page'), 1);
  const requestedLimit = readPositiveInteger(
    url.searchParams.get('limit'),
    defaultLimit
  );
  const limit = Math.min(requestedLimit, maxLimit);
  const dateFrom = readDate(url.searchParams.get('dateFrom'));
  const dateTo = readDate(url.searchParams.get('dateTo'));
  const sentiment = normalizeOptional(url.searchParams.get('sentiment'));
  const source = normalizeOptional(url.searchParams.get('source'));

  try {
    const input = {
      dateFrom,
      dateTo,
      direction,
      limit,
      page,
      q,
      sentiment,
      sort,
      source,
      userId: profile.id
    };

    let searchResult: {
      results: SearchResultItem[];
      total: number;
    };

    if (type === 'assets') {
      searchResult = await searchAssets(input);
    } else if (type === 'analyses') {
      searchResult = await searchAnalyses(input);
    } else {
      const groups = await Promise.all([
        searchAssets(input),
        searchAnalyses(input)
      ]);

      searchResult = mergeSearchResults(groups, limit, page, direction);
    }

    const totalPages = Math.max(1, Math.ceil(searchResult.total / limit));

    const response: SearchResponse = {
      filters: {
        dateFrom: dateFrom ? dateFrom.toISOString().slice(0, 10) : null,
        dateTo: dateTo ? dateTo.toISOString().slice(0, 10) : null,
        direction,
        limit,
        page,
        q,
        sentiment,
        sort,
        source,
        type
      },
      pagination: {
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        limit,
        page,
        total: searchResult.total,
        totalPages
      },
      results: searchResult.results
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Search failed:', error);

    return NextResponse.json(
      {
        error: 'Search failed.'
      },
      { status: 500 }
    );
  }
}
