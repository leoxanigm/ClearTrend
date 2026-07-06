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
import {
  readEnum,
  readPositiveInteger,
  readDateStart,
  readDateEnd,
  normalizeOptional,
  normalizeQuery,
  toIso,
  getDateFilter,
  getStringSearch,
  getAnalysisTrendLabel,
  getAssetOrderBy,
  getAnalysisOrderBy
} from '@/lib/search';
import { NextResponse } from 'next/server';
import { TrendLabel } from '@/generated/prisma/enums';

export const dynamic = 'force-dynamic';

const maxLimit = 50;
const defaultLimit = 10;

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
  userId: string;
  sort: SearchSortKey;
}) {
  const prisma = getPrisma();
  const skip = (input.page - 1) * input.limit;
  const createdAt = getDateFilter(input.dateFrom, input.dateTo);
  const trendLabel = getAnalysisTrendLabel(input.sentiment) as TrendLabel;

  const where = {
    ...(createdAt ? { createdAt } : {}),
    ...(trendLabel ? { trendLabel } : {}),
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
    href: `/dashboard?symbol=${encodeURIComponent(analysis.asset.symbol)}`,
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
    'assets'
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
  const dateFrom = readDateStart(url.searchParams.get('dateFrom'));
  const dateTo = readDateEnd(url.searchParams.get('dateTo'));
  const sentiment = normalizeOptional(url.searchParams.get('sentiment'));

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
      userId: profile.id
    };

    let searchResult: {
      results: SearchResultItem[];
      total: number;
    };

    if (type === 'assets') {
      searchResult = await searchAssets(input);
    } else {
      searchResult = await searchAnalyses(input);
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
